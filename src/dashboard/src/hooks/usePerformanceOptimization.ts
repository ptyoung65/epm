import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce, throttle } from 'lodash';

// 성능 모니터링 인터페이스
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  apiResponseTime: number;
  bundleSize: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

// 캐시 인터페이스
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

// 메모리 캐시 클래스
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100;

  set<T>(key: string, value: T, ttl: number = 300000): void { // 기본 5분 TTL
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 전역 캐시 인스턴스
const globalCache = new MemoryCache();

// 성능 최적화 훅
export const usePerformanceOptimization = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    apiResponseTime: 0,
    bundleSize: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    firstInputDelay: 0
  });

  const renderStartTime = useRef<number>(0);

  // 렌더링 성능 측정
  const measureRenderTime = useCallback(() => {
    renderStartTime.current = performance.now();
    
    // 다음 마이크로태스크에서 렌더링 완료 시간 측정
    Promise.resolve().then(() => {
      const renderTime = performance.now() - renderStartTime.current;
      setMetrics(prev => ({ ...prev, renderTime }));
    });
  }, []);

  // Web Vitals 측정
  useEffect(() => {
    if (!window.performance) return;

    // Performance Observer 사용하여 Web Vitals 측정
    const observePerformance = () => {
      // LCP 측정
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              setMetrics(prev => ({ 
                ...prev, 
                largestContentfulPaint: entry.startTime 
              }));
            }
            
            if (entry.entryType === 'first-input') {
              setMetrics(prev => ({ 
                ...prev, 
                firstInputDelay: (entry as any).processingStart - entry.startTime 
              }));
            }
          });
        });

        try {
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          observer.observe({ type: 'first-input', buffered: true });
        } catch (e) {
          console.warn('Performance observer not supported:', e);
        }
      }

      // Navigation Timing API 사용
      const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        setMetrics(prev => ({
          ...prev,
          firstContentfulPaint: navigationTiming.domContentLoadedEventStart
        }));
      }
    };

    // 페이지 로드 완료 후 측정
    if (document.readyState === 'complete') {
      observePerformance();
    } else {
      window.addEventListener('load', observePerformance);
    }

    // 메모리 사용량 모니터링
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memInfo.usedJSHeapSize / 1024 / 1024 // MB 단위
        }));
      }
    };

    const memoryInterval = setInterval(monitorMemory, 5000);

    return () => {
      clearInterval(memoryInterval);
      window.removeEventListener('load', observePerformance);
    };
  }, []);

  return {
    metrics,
    measureRenderTime,
    cache: globalCache
  };
};

// API 캐싱 훅
export const useApiCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    revalidateOnFocus?: boolean;
  } = {}
) => {
  const {
    ttl = 300000, // 5분
    enabled = true,
    revalidateOnFocus = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // 캐시에서 데이터 확인
    if (!force && globalCache.has(key)) {
      const cachedData = globalCache.get<T>(key);
      if (cachedData) {
        setData(cachedData);
        return cachedData;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      const result = await fetcher();
      const responseTime = performance.now() - startTime;

      // 성능 메트릭 업데이트
      // setMetrics(prev => ({ ...prev, apiResponseTime: responseTime }));

      // 캐시에 저장
      globalCache.set(key, result, ttl);
      setData(result);
      setLoading(false);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);
      throw error;
    }
  }, [key, fetcher, ttl, enabled]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 포커스 시 재검증
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData, revalidateOnFocus]);

  const mutate = useCallback(async (newData?: T) => {
    if (newData) {
      globalCache.set(key, newData, ttl);
      setData(newData);
    } else {
      await fetchData(true);
    }
  }, [key, fetchData, ttl]);

  return {
    data,
    loading,
    error,
    mutate,
    revalidate: () => fetchData(true)
  };
};

// 디바운스 훅
export const useDebounce = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const debouncedFn = useMemo(
    () => debounce(callback, delay),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      debouncedFn.cancel();
    };
  }, [debouncedFn]);

  return debouncedFn;
};

// 스로틀 훅
export const useThrottle = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const throttledFn = useMemo(
    () => throttle(callback, delay),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      throttledFn.cancel();
    };
  }, [throttledFn]);

  return throttledFn;
};

// 인터섹션 옵저버 훅 (레이지 로딩)
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      options
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return {
    elementRef,
    entry,
    isIntersecting: entry?.isIntersecting ?? false,
    intersectionRatio: entry?.intersectionRatio ?? 0
  };
};

// 가상화 훅 (대용량 리스트 최적화)
export const useVirtualization = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16); // 60fps

  return {
    visibleItems,
    handleScroll,
    scrollTop
  };
};

// 이미지 레이지 로딩 훅
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px'
  });

  useEffect(() => {
    if (!isIntersecting || !src) return;

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setIsError(true);
    };
    img.src = src;
  }, [src, isIntersecting]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isError,
    isIntersecting
  };
};

// 메모화된 값 훅 (깊은 비교 포함)
export const useDeepMemo = <T>(
  factory: () => T,
  deps: React.DependencyList
) => {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps: [...deps],
      value: factory()
    };
  }

  return ref.current.value;
};

// 깊은 비교 함수
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b;
  }

  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }

  if (a.prototype !== b.prototype) return false;

  let keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  return keys.every(k => deepEqual(a[k], b[k]));
}