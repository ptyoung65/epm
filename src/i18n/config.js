/**
 * i18n Configuration for AIRIS EPM Web Application
 * Supports English, Korean, Japanese, and Chinese languages
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import language resources
import enTranslations from './locales/en/common.json';
import koTranslations from './locales/ko/common.json';
import jaTranslations from './locales/ja/common.json';
import zhTranslations from './locales/zh/common.json';

// Language detection configuration
const detectionOptions = {
  // Order and from where user language should be detected
  order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
  
  // Keys or params to lookup language from
  lookupFromPathIndex: 0,
  lookupFromSubdomainIndex: 0,
  
  // Cache user language on
  caches: ['localStorage'],
  
  // Optional expire and domain for set cookie
  cookieMinutes: 10080, // 7 days
  cookieDomain: process.env.REACT_APP_DOMAIN || 'airis-epm.com',
  
  // Optional htmlTag with lang attribute
  htmlTag: document.documentElement,
  
  // Only detect languages that are in the whitelist
  checkWhitelist: true,
};

// Backend configuration for loading translations
const backendOptions = {
  loadPath: '/locales/{{lng}}/{{ns}}.json',
  
  // Allow cross domain requests
  crossDomain: false,
  
  // Allow credentials on cross domain requests
  withCredentials: false,
  
  // Override mime type of the requests
  overrideMimeType: false,
  
  // Custom request headers
  customHeaders: {},
  
  // Query string parameters
  queryStringParams: { v: '1.0.0' },
  
  // Reload resources on cache miss
  reloadInterval: false,
};

// Initialize i18next
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Fallback language
    fallbackLng: 'en',
    
    // Debug mode
    debug: process.env.NODE_ENV === 'development',
    
    // Language whitelist
    supportedLngs: ['en', 'ko', 'ja', 'zh'],
    
    // Namespace
    ns: ['common', 'dashboard', 'errors', 'forms'],
    defaultNS: 'common',
    
    // Language detection
    detection: detectionOptions,
    
    // Backend options
    backend: backendOptions,
    
    // Resources (for fallback)
    resources: {
      en: {
        common: enTranslations,
      },
      ko: {
        common: koTranslations,
      },
      ja: {
        common: jaTranslations,
      },
      zh: {
        common: zhTranslations,
      },
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
      formatSeparator: ',',
      format: function(value, format, lng) {
        // Custom formatting for different data types
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        
        // Date formatting
        if (format === 'date') {
          const date = new Date(value);
          return date.toLocaleDateString(lng, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
        
        // Time formatting
        if (format === 'time') {
          const date = new Date(value);
          return date.toLocaleTimeString(lng, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        }
        
        // Currency formatting
        if (format === 'currency') {
          const currencies = {
            en: { currency: 'USD', locale: 'en-US' },
            ko: { currency: 'KRW', locale: 'ko-KR' },
            ja: { currency: 'JPY', locale: 'ja-JP' },
            zh: { currency: 'CNY', locale: 'zh-CN' },
          };
          
          const config = currencies[lng] || currencies['en'];
          return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: config.currency,
          }).format(value);
        }
        
        // Number formatting
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        
        return value;
      },
    },
    
    // React options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span'],
    },
    
    // Pluralization
    pluralSeparator: '_',
    contextSeparator: '_',
    
    // Loading options
    load: 'languageOnly', // Remove region code from language
    preload: ['en'], // Preload English
    
    // Key separator
    keySeparator: '.',
    nsSeparator: ':',
    
    // Missing key handling
    saveMissing: process.env.NODE_ENV === 'development',
    saveMissingTo: 'fallback',
    missingKeyHandler: function(lng, ns, key, fallbackValue) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation key: ${lng}.${ns}.${key}`);
      }
    },
    
    // Post processing
    postProcess: ['interval', 'plural'],
    
    // Clean code handling
    cleanCode: true,
  });

// Language change handler
i18n.on('languageChanged', (lng) => {
  // Update document language
  document.documentElement.lang = lng;
  
  // Update document direction for RTL languages
  const rtlLanguages = ['ar', 'he', 'fa'];
  document.documentElement.dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr';
  
  // Update meta tags
  const metaLang = document.querySelector('meta[name="language"]');
  if (metaLang) {
    metaLang.content = lng;
  }
  
  // Store current language for CDN routing
  localStorage.setItem('airis-preferred-language', lng);
  
  // Notify analytics
  if (window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      custom_map: { custom_dimension_1: lng }
    });
  }
});

// Error handling
i18n.on('failedLoading', (lng, ns, msg) => {
  console.error(`Failed to load language ${lng} namespace ${ns}: ${msg}`);
});

// Add custom helper functions
i18n.getResourceBundle = function(lng, ns) {
  return i18n.getDataByLanguage(lng)?.[ns] || {};
};

i18n.getSupportedLanguages = function() {
  return i18n.options.supportedLngs.filter(lng => lng !== 'cimode');
};

i18n.getCurrentLanguageInfo = function() {
  const current = i18n.language || 'en';
  const languageInfo = {
    en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
    ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  };
  
  return {
    code: current,
    ...languageInfo[current] || languageInfo['en']
  };
};

// Region-specific configurations
i18n.getRegionConfig = function(lng = i18n.language) {
  const regionConfigs = {
    en: {
      dateFormat: 'MM/dd/yyyy',
      timeFormat: '12h',
      currency: 'USD',
      numberFormat: 'en-US',
      timezone: 'America/New_York',
      weekStart: 0, // Sunday
    },
    ko: {
      dateFormat: 'yyyy.MM.dd',
      timeFormat: '24h',
      currency: 'KRW',
      numberFormat: 'ko-KR',
      timezone: 'Asia/Seoul',
      weekStart: 1, // Monday
    },
    ja: {
      dateFormat: 'yyyy/MM/dd',
      timeFormat: '24h',
      currency: 'JPY',
      numberFormat: 'ja-JP',
      timezone: 'Asia/Tokyo',
      weekStart: 1, // Monday
    },
    zh: {
      dateFormat: 'yyyy年MM月dd日',
      timeFormat: '24h',
      currency: 'CNY',
      numberFormat: 'zh-CN',
      timezone: 'Asia/Shanghai',
      weekStart: 1, // Monday
    },
  };
  
  return regionConfigs[lng] || regionConfigs['en'];
};

export default i18n;