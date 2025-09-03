/**
 * Language Selector Component for AIRIS EPM
 * Provides language switching functionality with geolocation detection
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector = ({ className = '', showFlag = true, showText = true, compact = false }) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  
  // Language configurations with flags and regions
  const languages = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
      regions: ['US', 'CA', 'AU', 'GB', 'IE'],
      rtl: false,
    },
    {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      flag: '🇰🇷',
      regions: ['KR'],
      rtl: false,
    },
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      flag: '🇯🇵',
      regions: ['JP'],
      rtl: false,
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      flag: '🇨🇳',
      regions: ['CN', 'TW', 'HK', 'SG'],
      rtl: false,
    },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  // Detect user location for auto-language suggestion
  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Try to get location from various sources
        let countryCode = null;
        
        // 1. Try CloudFlare headers (if available)
        if (window.CF && window.CF.country) {
          countryCode = window.CF.country;
        }
        
        // 2. Try geolocation API
        if (!countryCode && navigator.geolocation) {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 600000, // 10 minutes
            });
          });
          
          // Reverse geocoding would be needed here
          // For now, we'll use browser language as fallback
        }
        
        // 3. Use browser language as fallback
        if (!countryCode) {
          const browserLang = navigator.language || navigator.userLanguage;
          countryCode = browserLang.split('-')[1] || 'US';
        }
        
        setUserLocation(countryCode);
        
        // Auto-suggest language based on location
        const suggestedLang = languages.find(lang => 
          lang.regions.includes(countryCode?.toUpperCase())
        );
        
        if (suggestedLang && suggestedLang.code !== i18n.language && !localStorage.getItem('airis-language-dismissed')) {
          showLanguageSuggestion(suggestedLang);
        }
        
      } catch (error) {
        console.warn('Location detection failed:', error);
      }
    };
    
    detectLocation();
  }, [i18n.language]);

  // Show language suggestion notification
  const showLanguageSuggestion = (suggestedLang) => {
    const suggestion = document.createElement('div');
    suggestion.className = `
      fixed top-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm
      transform transition-transform duration-300 translate-x-full
    `;
    suggestion.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="text-2xl">${suggestedLang.flag}</span>
        <div class="flex-1">
          <p class="font-medium">Switch to ${suggestedLang.nativeName}?</p>
          <p class="text-sm opacity-90">Detected location: ${userLocation}</p>
        </div>
        <div class="flex space-x-2">
          <button class="bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded text-xs" onclick="switchLanguage('${suggestedLang.code}')">
            Yes
          </button>
          <button class="bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded text-xs" onclick="dismissSuggestion()">
            No
          </button>
        </div>
      </div>
    `;
    
    // Add global functions for buttons
    window.switchLanguage = (langCode) => {
      i18n.changeLanguage(langCode);
      document.body.removeChild(suggestion);
    };
    
    window.dismissSuggestion = () => {
      localStorage.setItem('airis-language-dismissed', 'true');
      document.body.removeChild(suggestion);
    };
    
    document.body.appendChild(suggestion);
    
    // Animate in
    setTimeout(() => {
      suggestion.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(suggestion)) {
        suggestion.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (document.body.contains(suggestion)) {
            document.body.removeChild(suggestion);
          }
        }, 300);
      }
    }, 10000);
  };

  // Handle language change
  const handleLanguageChange = async (langCode) => {
    try {
      await i18n.changeLanguage(langCode);
      setIsOpen(false);
      
      // Update document attributes
      document.documentElement.lang = langCode;
      const selectedLang = languages.find(lang => lang.code === langCode);
      document.documentElement.dir = selectedLang?.rtl ? 'rtl' : 'ltr';
      
      // Show success notification
      showNotification(`Language switched to ${selectedLang?.nativeName || langCode}`, 'success');
      
      // Analytics tracking
      if (window.gtag) {
        window.gtag('event', 'language_change', {
          event_category: 'Localization',
          event_label: langCode,
          custom_map: { custom_dimension_1: langCode }
        });
      }
      
      // Store user preference
      localStorage.setItem('airis-preferred-language', langCode);
      
    } catch (error) {
      console.error('Language change failed:', error);
      showNotification('Failed to change language', 'error');
    }
  };

  // Show notification helper
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `
      fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white
      transform transition-transform duration-300 translate-y-full
      ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  // Handle outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && !event.target.closest('.language-selector')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // Compact view for mobile/small spaces
  if (compact) {
    return (
      <div className={`relative language-selector ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={`Current language: ${currentLanguage.nativeName}`}
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-32">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`
                  w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                  ${language.code === i18n.language ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}
                `}
              >
                <span className="mr-2">{language.flag}</span>
                <span className="text-sm">{language.nativeName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className={`relative language-selector ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Current language: ${currentLanguage.nativeName}`}
      >
        {showFlag && <span className="text-xl">{currentLanguage.flag}</span>}
        {showText && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentLanguage.nativeName}
          </span>
        )}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-48">
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {t('settings.language')}
            {userLocation && (
              <span className="ml-2 text-blue-500">({userLocation})</span>
            )}
          </div>
          
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`
                w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                ${language.code === i18n.language ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{language.flag}</span>
                <div>
                  <div className="font-medium text-sm">{language.nativeName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{language.name}</div>
                </div>
                {language.code === i18n.language && (
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
          
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span>Auto-detect location</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  defaultChecked={!localStorage.getItem('airis-language-dismissed')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      localStorage.removeItem('airis-language-dismissed');
                    } else {
                      localStorage.setItem('airis-language-dismissed', 'true');
                    }
                  }}
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;