/**
 * Localization Utilities for AIRIS EPM
 * Handles dates, times, currencies, and numbers across different regions
 */

import i18n from '../i18n/config';

// Region-specific configurations
const REGION_CONFIGS = {
  'en': {
    locale: 'en-US',
    currency: 'USD',
    timezone: 'America/New_York',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    firstDayOfWeek: 0, // Sunday
    weekendDays: [0, 6], // Sunday, Saturday
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    units: {
      temperature: 'fahrenheit',
      distance: 'miles',
      weight: 'pounds',
    },
  },
  'ko': {
    locale: 'ko-KR',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    dateFormat: 'yyyy.MM.dd',
    timeFormat: '24h',
    firstDayOfWeek: 1, // Monday
    weekendDays: [0, 6], // Sunday, Saturday
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    units: {
      temperature: 'celsius',
      distance: 'kilometers',
      weight: 'kilograms',
    },
  },
  'ja': {
    locale: 'ja-JP',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: '24h',
    firstDayOfWeek: 1, // Monday
    weekendDays: [0, 6], // Sunday, Saturday
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    units: {
      temperature: 'celsius',
      distance: 'kilometers',
      weight: 'kilograms',
    },
  },
  'zh': {
    locale: 'zh-CN',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    dateFormat: 'yyyy年MM月dd日',
    timeFormat: '24h',
    firstDayOfWeek: 1, // Monday
    weekendDays: [0, 6], // Sunday, Saturday
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    units: {
      temperature: 'celsius',
      distance: 'kilometers',
      weight: 'kilograms',
    },
  },
};

// Get current region configuration
export const getCurrentRegionConfig = () => {
  const currentLang = i18n.language || 'en';
  return REGION_CONFIGS[currentLang] || REGION_CONFIGS['en'];
};

// Format date according to current locale
export const formatDate = (date, options = {}) => {
  const config = getCurrentRegionConfig();
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: config.timezone,
    ...options,
  };
  
  try {
    return dateObj.toLocaleDateString(config.locale, defaultOptions);
  } catch (error) {
    console.warn('Date formatting failed:', error);
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  }
};

// Format time according to current locale
export const formatTime = (date, options = {}) => {
  const config = getCurrentRegionConfig();
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time';
  }
  
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: options.showSeconds ? '2-digit' : undefined,
    hour12: config.timeFormat === '12h',
    timeZone: config.timezone,
    ...options,
  };
  
  try {
    return dateObj.toLocaleTimeString(config.locale, defaultOptions);
  } catch (error) {
    console.warn('Time formatting failed:', error);
    return dateObj.toLocaleTimeString('en-US', defaultOptions);
  }
};

// Format datetime according to current locale
export const formatDateTime = (date, options = {}) => {
  const config = getCurrentRegionConfig();
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid DateTime';
  }
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: config.timeFormat === '12h',
    timeZone: config.timezone,
    ...options,
  };
  
  try {
    return dateObj.toLocaleString(config.locale, defaultOptions);
  } catch (error) {
    console.warn('DateTime formatting failed:', error);
    return dateObj.toLocaleString('en-US', defaultOptions);
  }
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (date, options = {}) => {
  const config = getCurrentRegionConfig();
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  // Use Intl.RelativeTimeFormat if available
  if (Intl.RelativeTimeFormat) {
    try {
      const rtf = new Intl.RelativeTimeFormat(config.locale, {
        numeric: 'auto',
        style: options.style || 'long',
      });
      
      if (diffYears > 0) return rtf.format(-diffYears, 'year');
      if (diffMonths > 0) return rtf.format(-diffMonths, 'month');
      if (diffWeeks > 0) return rtf.format(-diffWeeks, 'week');
      if (diffDays > 0) return rtf.format(-diffDays, 'day');
      if (diffHours > 0) return rtf.format(-diffHours, 'hour');
      if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute');
      if (diffSeconds > 0) return rtf.format(-diffSeconds, 'second');
      
      return rtf.format(0, 'second'); // "now"
    } catch (error) {
      console.warn('RelativeTimeFormat failed:', error);
    }
  }
  
  // Fallback implementation
  const translations = {
    en: { now: 'now', s: 's ago', m: 'm ago', h: 'h ago', d: 'd ago', w: 'w ago', mo: 'mo ago', y: 'y ago' },
    ko: { now: '지금', s: '초 전', m: '분 전', h: '시간 전', d: '일 전', w: '주 전', mo: '개월 전', y: '년 전' },
    ja: { now: '今', s: '秒前', m: '分前', h: '時間前', d: '日前', w: '週間前', mo: 'ヶ月前', y: '年前' },
    zh: { now: '现在', s: '秒前', m: '分钟前', h: '小时前', d: '天前', w: '周前', mo: '个月前', y: '年前' },
  };
  
  const t = translations[i18n.language] || translations.en;
  
  if (diffYears > 0) return `${diffYears}${t.y}`;
  if (diffMonths > 0) return `${diffMonths}${t.mo}`;
  if (diffWeeks > 0) return `${diffWeeks}${t.w}`;
  if (diffDays > 0) return `${diffDays}${t.d}`;
  if (diffHours > 0) return `${diffHours}${t.h}`;
  if (diffMinutes > 0) return `${diffMinutes}${t.m}`;
  if (diffSeconds > 10) return `${diffSeconds}${t.s}`;
  
  return t.now;
};

// Format currency according to current locale
export const formatCurrency = (amount, currencyCode = null, options = {}) => {
  const config = getCurrentRegionConfig();
  const currency = currencyCode || config.currency;
  
  const defaultOptions = {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  };
  
  try {
    return new Intl.NumberFormat(config.locale, defaultOptions).format(amount);
  } catch (error) {
    console.warn('Currency formatting failed:', error);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      ...defaultOptions,
    }).format(amount);
  }
};

// Format number according to current locale
export const formatNumber = (number, options = {}) => {
  const config = getCurrentRegionConfig();
  
  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: true,
    ...options,
  };
  
  try {
    return new Intl.NumberFormat(config.locale, defaultOptions).format(number);
  } catch (error) {
    console.warn('Number formatting failed:', error);
    return new Intl.NumberFormat('en-US', defaultOptions).format(number);
  }
};

// Format percentage
export const formatPercentage = (value, options = {}) => {
  const config = getCurrentRegionConfig();
  
  const defaultOptions = {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  };
  
  try {
    return new Intl.NumberFormat(config.locale, defaultOptions).format(value / 100);
  } catch (error) {
    console.warn('Percentage formatting failed:', error);
    return new Intl.NumberFormat('en-US', defaultOptions).format(value / 100);
  }
};

// Format file size
export const formatFileSize = (bytes, options = {}) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = Math.abs(bytes);
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  const formattedSize = formatNumber(size, {
    minimumFractionDigits: 0,
    maximumFractionDigits: size < 10 ? 2 : size < 100 ? 1 : 0,
    ...options,
  });
  
  return `${formattedSize} ${units[unitIndex]}`;
};

// Format duration (milliseconds to human readable)
export const formatDuration = (ms, options = {}) => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${formatNumber(seconds, { maximumFractionDigits: 1 })}s`;
  }
  
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${formatNumber(minutes, { maximumFractionDigits: 1 })}m`;
  }
  
  const hours = minutes / 60;
  if (hours < 24) {
    return `${formatNumber(hours, { maximumFractionDigits: 1 })}h`;
  }
  
  const days = hours / 24;
  return `${formatNumber(days, { maximumFractionDigits: 1 })}d`;
};

// Get localized day names
export const getDayNames = (format = 'long') => {
  const config = getCurrentRegionConfig();
  const baseDate = new Date(2023, 0, 1); // Sunday
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + i);
    
    try {
      const dayName = date.toLocaleDateString(config.locale, { 
        weekday: format,
        timeZone: config.timezone,
      });
      days.push(dayName);
    } catch (error) {
      const fallbackNames = {
        long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      };
      days.push(fallbackNames[format] || fallbackNames.long);
    }
  }
  
  // Reorder based on first day of week
  const firstDay = config.firstDayOfWeek;
  return [...days.slice(firstDay), ...days.slice(0, firstDay)];
};

// Get localized month names
export const getMonthNames = (format = 'long') => {
  const config = getCurrentRegionConfig();
  const months = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(2023, i, 1);
    
    try {
      const monthName = date.toLocaleDateString(config.locale, { 
        month: format,
        timeZone: config.timezone,
      });
      months.push(monthName);
    } catch (error) {
      const fallbackNames = {
        long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      };
      months.push(fallbackNames[format][i] || fallbackNames.long[i]);
    }
  }
  
  return months;
};

// Convert timezone
export const convertTimezone = (date, targetTimezone) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  try {
    return new Date(dateObj.toLocaleString('en-US', { timeZone: targetTimezone }));
  } catch (error) {
    console.warn('Timezone conversion failed:', error);
    return dateObj;
  }
};

// Get user's timezone
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect timezone:', error);
    return getCurrentRegionConfig().timezone;
  }
};

// Parse localized date input
export const parseLocalizedDate = (dateString) => {
  const config = getCurrentRegionConfig();
  
  // Try various parsing methods
  const parsers = [
    () => new Date(dateString),
    () => {
      // Try to parse based on locale format
      const format = config.dateFormat;
      const parts = dateString.match(/\d+/g);
      if (!parts || parts.length < 3) return null;
      
      if (format.includes('yyyy')) {
        // Year first: yyyy.MM.dd, yyyy/MM/dd, yyyy年MM月dd日
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (format.startsWith('MM')) {
        // Month first: MM/dd/yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        // Day first: dd.MM.yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    },
  ];
  
  for (const parser of parsers) {
    try {
      const parsed = parser();
      if (parsed && !isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch (error) {
      // Continue to next parser
    }
  }
  
  return null;
};

// Validate localized number input
export const parseLocalizedNumber = (numberString) => {
  const config = getCurrentRegionConfig();
  
  try {
    // Remove grouping separators and convert decimal separator
    let cleaned = numberString.toString()
      .replace(new RegExp(`\\${config.numberFormat.thousands}`, 'g'), '')
      .replace(config.numberFormat.decimal, '.');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  } catch (error) {
    console.warn('Number parsing failed:', error);
    return null;
  }
};

// Export region configurations for external use
export const getRegionConfigs = () => REGION_CONFIGS;

// Export default formatter functions bound to current locale
export const createLocalizedFormatters = () => {
  const config = getCurrentRegionConfig();
  
  return {
    date: (date, options) => formatDate(date, options),
    time: (date, options) => formatTime(date, options),
    dateTime: (date, options) => formatDateTime(date, options),
    relativeTime: (date, options) => formatRelativeTime(date, options),
    currency: (amount, currencyCode, options) => formatCurrency(amount, currencyCode, options),
    number: (number, options) => formatNumber(number, options),
    percentage: (value, options) => formatPercentage(value, options),
    fileSize: (bytes, options) => formatFileSize(bytes, options),
    duration: (ms, options) => formatDuration(ms, options),
    config,
  };
};