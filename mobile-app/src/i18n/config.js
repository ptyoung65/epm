/**
 * i18n Configuration for AIRIS EPM Mobile Application (React Native)
 * Supports English, Korean, Japanese, and Chinese languages
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import RNLanguageDetector from 'i18next-react-native-language-detector';
import { getLocales } from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import language resources
import enTranslations from './locales/en/common.json';
import koTranslations from './locales/ko/common.json';
import jaTranslations from './locales/ja/common.json';
import zhTranslations from './locales/zh/common.json';

// Custom language detector for React Native
const customLanguageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      // Try to get language from AsyncStorage first
      const storedLanguage = await AsyncStorage.getItem('@airis_language');
      if (storedLanguage) {
        callback(storedLanguage);
        return;
      }
      
      // Fallback to device locale
      const locales = getLocales();
      const deviceLanguage = locales[0]?.languageCode || 'en';
      
      // Map device language to supported languages
      const supportedLanguages = ['en', 'ko', 'ja', 'zh'];
      const language = supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'en';
      
      callback(language);
    } catch (error) {
      console.warn('Language detection failed, falling back to English:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem('@airis_language', language);
    } catch (error) {
      console.warn('Failed to cache user language:', error);
    }
  },
};

// Initialize i18next for React Native
i18n
  .use(customLanguageDetector)
  .use(initReactI18next)
  .init({
    // Fallback language
    fallbackLng: 'en',
    
    // Debug mode
    debug: __DEV__,
    
    // Language whitelist
    supportedLngs: ['en', 'ko', 'ja', 'zh'],
    
    // Namespace
    ns: ['common', 'dashboard', 'errors', 'forms', 'alerts'],
    defaultNS: 'common',
    
    // Resources
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
      escapeValue: false, // React Native already handles escaping
      formatSeparator: ',',
      format: function(value, format, lng) {
        // Custom formatting for different data types
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        
        // Date formatting for mobile
        if (format === 'date') {
          const date = new Date(value);
          const locales = getLocales();
          const locale = locales[0]?.languageTag || 'en-US';
          
          return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
        
        // Time formatting for mobile
        if (format === 'time') {
          const date = new Date(value);
          const locales = getLocales();
          const locale = locales[0]?.languageTag || 'en-US';
          const uses24HourClock = locales[0]?.uses24HourClock || false;
          
          return date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: !uses24HourClock,
          });
        }
        
        // Currency formatting for mobile
        if (format === 'currency') {
          const currencies = {
            en: { currency: 'USD', locale: 'en-US' },
            ko: { currency: 'KRW', locale: 'ko-KR' },
            ja: { currency: 'JPY', locale: 'ja-JP' },
            zh: { currency: 'CNY', locale: 'zh-CN' },
          };
          
          const config = currencies[lng] || currencies['en'];
          const locales = getLocales();
          const deviceCurrency = locales[0]?.currencyCode;
          
          return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: deviceCurrency || config.currency,
          }).format(value);
        }
        
        // Number formatting
        if (format === 'number') {
          const locales = getLocales();
          const locale = locales[0]?.languageTag || lng;
          return new Intl.NumberFormat(locale).format(value);
        }
        
        return value;
      },
    },
    
    // React options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
    
    // Pluralization
    pluralSeparator: '_',
    contextSeparator: '_',
    
    // Loading options
    load: 'languageOnly',
    preload: ['en'],
    
    // Key separator
    keySeparator: '.',
    nsSeparator: ':',
    
    // Missing key handling
    saveMissing: __DEV__,
    missingKeyHandler: function(lng, ns, key) {
      if (__DEV__) {
        console.warn(`Missing translation key: ${lng}.${ns}.${key}`);
      }
    },
  });

// Language change handler
i18n.on('languageChanged', async (lng) => {
  try {
    // Cache the language selection
    await AsyncStorage.setItem('@airis_language', lng);
    
    // Store for analytics
    await AsyncStorage.setItem('@airis_language_changed_at', new Date().toISOString());
    
    console.log(`Language changed to: ${lng}`);
  } catch (error) {
    console.warn('Failed to handle language change:', error);
  }
});

// Add mobile-specific helper functions
i18n.getDeviceLocale = function() {
  const locales = getLocales();
  return {
    languageCode: locales[0]?.languageCode || 'en',
    countryCode: locales[0]?.countryCode || 'US',
    languageTag: locales[0]?.languageTag || 'en-US',
    isRTL: locales[0]?.isRTL || false,
    uses24HourClock: locales[0]?.uses24HourClock || false,
    currencyCode: locales[0]?.currencyCode || 'USD',
    temperatureUnit: locales[0]?.temperatureUnit || 'celsius',
  };
};

i18n.getSupportedLanguages = function() {
  return [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ];
};

i18n.getCurrentLanguageInfo = function() {
  const current = i18n.language || 'en';
  const languages = i18n.getSupportedLanguages();
  return languages.find(lang => lang.code === current) || languages[0];
};

// Mobile-specific region configurations
i18n.getMobileRegionConfig = function(lng = i18n.language) {
  const deviceLocale = i18n.getDeviceLocale();
  const regionConfigs = {
    en: {
      dateFormat: 'MM/dd/yyyy',
      timeFormat: deviceLocale.uses24HourClock ? '24h' : '12h',
      currency: deviceLocale.currencyCode || 'USD',
      numberFormat: deviceLocale.languageTag || 'en-US',
      weekStart: 0, // Sunday
      temperatureUnit: deviceLocale.temperatureUnit || 'fahrenheit',
    },
    ko: {
      dateFormat: 'yyyy.MM.dd',
      timeFormat: '24h',
      currency: 'KRW',
      numberFormat: 'ko-KR',
      weekStart: 1, // Monday
      temperatureUnit: 'celsius',
    },
    ja: {
      dateFormat: 'yyyy/MM/dd',
      timeFormat: '24h',
      currency: 'JPY',
      numberFormat: 'ja-JP',
      weekStart: 1, // Monday
      temperatureUnit: 'celsius',
    },
    zh: {
      dateFormat: 'yyyy年MM月dd日',
      timeFormat: '24h',
      currency: 'CNY',
      numberFormat: 'zh-CN',
      weekStart: 1, // Monday
      temperatureUnit: 'celsius',
    },
  };
  
  return regionConfigs[lng] || regionConfigs['en'];
};

// Initialize with device locale detection
i18n.changeLanguage(i18n.language).catch(error => {
  console.warn('Initial language setup failed:', error);
});

export default i18n;