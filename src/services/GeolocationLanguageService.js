/**
 * Geolocation-based Language Detection Service
 * Automatically detects and suggests languages based on user location and preferences
 */

import i18n from '../i18n/config';

class GeolocationLanguageService {
  constructor() {
    this.locationCache = new Map();
    this.ipGeolocationServices = [
      {
        name: 'ipapi',
        url: 'https://ipapi.co/json/',
        parser: (data) => ({
          country: data.country_code,
          region: data.region,
          city: data.city,
          timezone: data.timezone,
          languages: data.languages?.split(',') || [],
        }),
      },
      {
        name: 'ipgeolocation',
        url: 'https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_API_KEY',
        parser: (data) => ({
          country: data.country_code2,
          region: data.state_prov,
          city: data.city,
          timezone: data.time_zone.name,
          languages: [data.country_code2.toLowerCase()],
        }),
      },
      {
        name: 'geojs',
        url: 'https://get.geojs.io/v1/ip/geo.json',
        parser: (data) => ({
          country: data.country_code,
          region: data.region,
          city: data.city,
          timezone: data.timezone,
          languages: [data.country_code.toLowerCase()],
        }),
      },
    ];
    
    this.countryLanguageMap = this.loadCountryLanguageMapping();
    this.init();
  }

  // Initialize the service
  async init() {
    try {
      // Check if we have cached location data
      const cached = this.getCachedLocation();
      if (cached && !this.isCacheExpired(cached)) {
        this.processLocationData(cached);
        return;
      }

      // Try to get location data from various sources
      await this.detectLocation();
    } catch (error) {
      console.warn('GeolocationLanguageService initialization failed:', error);
    }
  }

  // Load country to language mapping
  loadCountryLanguageMapping() {
    return {
      // English-speaking countries
      'US': ['en'], 'CA': ['en', 'fr'], 'GB': ['en'], 'AU': ['en'], 'NZ': ['en'],
      'IE': ['en'], 'ZA': ['en'], 'SG': ['en', 'zh'], 'IN': ['en'],
      
      // Korean
      'KR': ['ko'],
      
      // Japanese
      'JP': ['ja'],
      
      // Chinese
      'CN': ['zh'], 'TW': ['zh'], 'HK': ['zh', 'en'], 'MO': ['zh'],
      
      // European countries
      'DE': ['de'], 'FR': ['fr'], 'ES': ['es'], 'IT': ['it'], 'PT': ['pt'],
      'NL': ['nl'], 'BE': ['fr', 'nl'], 'CH': ['de', 'fr', 'it'],
      'AT': ['de'], 'SE': ['sv'], 'NO': ['no'], 'DK': ['da'], 'FI': ['fi'],
      'PL': ['pl'], 'CZ': ['cs'], 'HU': ['hu'], 'RO': ['ro'], 'BG': ['bg'],
      'GR': ['el'], 'HR': ['hr'], 'SK': ['sk'], 'SI': ['sl'],
      
      // Other regions
      'BR': ['pt'], 'MX': ['es'], 'AR': ['es'], 'CL': ['es'], 'CO': ['es'],
      'RU': ['ru'], 'UA': ['uk'], 'BY': ['be'], 'KZ': ['kk', 'ru'],
      'TR': ['tr'], 'IL': ['he'], 'AE': ['ar'], 'SA': ['ar'],
      'TH': ['th'], 'VN': ['vi'], 'MY': ['ms'], 'ID': ['id'], 'PH': ['en'],
    };
  }

  // Detect user location from various sources
  async detectLocation() {
    try {
      // Method 1: Try CloudFlare headers (most reliable for CDN users)
      let locationData = await this.getCloudflareLocation();
      
      // Method 2: Try browser geolocation API
      if (!locationData) {
        locationData = await this.getBrowserGeolocation();
      }
      
      // Method 3: Try IP geolocation services
      if (!locationData) {
        locationData = await this.getIPGeolocation();
      }
      
      // Method 4: Fallback to browser language
      if (!locationData) {
        locationData = this.getBrowserLanguageLocation();
      }

      if (locationData) {
        this.cacheLocation(locationData);
        this.processLocationData(locationData);
      }

    } catch (error) {
      console.error('Location detection failed:', error);
      this.handleDetectionFailure();
    }
  }

  // Get location from CloudFlare headers
  async getCloudflareLocation() {
    try {
      // CloudFlare injects location data into headers
      if (window.CF && window.CF.country) {
        return {
          country: window.CF.country,
          region: window.CF.region || null,
          city: window.CF.city || null,
          timezone: window.CF.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          source: 'cloudflare',
          accuracy: 'high',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Also check for CloudFlare request headers if available
      const response = await fetch('/cdn-cgi/trace', { method: 'GET' });
      if (response.ok) {
        const text = await response.text();
        const data = this.parseCloudflareTrace(text);
        if (data.loc) {
          return {
            country: data.loc,
            timezone: data.ts ? new Date(data.ts * 1000).getTimezoneOffset() : null,
            source: 'cloudflare-trace',
            accuracy: 'high',
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      console.debug('CloudFlare location not available:', error);
    }
    
    return null;
  }

  // Parse CloudFlare trace response
  parseCloudflareTrace(text) {
    const data = {};
    text.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        data[key] = value;
      }
    });
    return data;
  }

  // Get location from browser geolocation API
  async getBrowserGeolocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      const options = {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000, // 10 minutes
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Reverse geocoding to get country
            const { latitude, longitude } = position.coords;
            const country = await this.reverseGeocode(latitude, longitude);
            
            resolve({
              country: country,
              coordinates: { latitude, longitude },
              accuracy: position.coords.accuracy,
              source: 'browser-geolocation',
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.warn('Reverse geocoding failed:', error);
            resolve(null);
          }
        },
        (error) => {
          console.debug('Browser geolocation failed:', error);
          resolve(null);
        },
        options
      );
    });
  }

  // Reverse geocoding to get country from coordinates
  async reverseGeocode(latitude, longitude) {
    try {
      // Using a free geocoding service (you might want to use a more reliable service in production)
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.countryCode;
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }
    
    return null;
  }

  // Get location from IP geolocation services
  async getIPGeolocation() {
    for (const service of this.ipGeolocationServices) {
      try {
        const response = await fetch(service.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const parsed = service.parser(data);
          
          return {
            ...parsed,
            source: service.name,
            accuracy: 'medium',
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.debug(`IP geolocation service ${service.name} failed:`, error);
        continue;
      }
    }
    
    return null;
  }

  // Get location from browser language settings
  getBrowserLanguageLocation() {
    try {
      const language = navigator.language || navigator.userLanguage || 'en-US';
      const [lang, region] = language.split('-');
      
      // Map language codes to likely countries
      const languageCountryMap = {
        'en': 'US', 'ko': 'KR', 'ja': 'JP', 'zh': 'CN',
        'de': 'DE', 'fr': 'FR', 'es': 'ES', 'it': 'IT',
        'pt': 'BR', 'ru': 'RU', 'ar': 'SA', 'th': 'TH',
      };
      
      const country = region || languageCountryMap[lang] || 'US';
      
      return {
        country: country,
        language: lang,
        source: 'browser-language',
        accuracy: 'low',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Browser language detection failed:', error);
      return null;
    }
  }

  // Process location data and suggest language
  processLocationData(locationData) {
    try {
      const country = locationData.country?.toUpperCase();
      if (!country) return;

      // Get suggested languages for this country
      const suggestedLanguages = this.countryLanguageMap[country] || ['en'];
      const currentLanguage = i18n.language;
      
      // Check if current language is already suitable
      if (suggestedLanguages.includes(currentLanguage)) {
        return;
      }
      
      // Find the best matching supported language
      const supportedLanguages = ['en', 'ko', 'ja', 'zh'];
      const bestMatch = suggestedLanguages.find(lang => 
        supportedLanguages.includes(lang)
      ) || 'en';
      
      // Only suggest if different from current
      if (bestMatch !== currentLanguage) {
        this.suggestLanguageChange(bestMatch, locationData);
      }
      
      // Store location for compliance purposes
      this.storeLocationForCompliance(locationData);
      
    } catch (error) {
      console.error('Location data processing failed:', error);
    }
  }

  // Suggest language change to user
  suggestLanguageChange(suggestedLanguage, locationData) {
    // Check if user has already dismissed suggestions
    const dismissed = localStorage.getItem('airis-language-suggestion-dismissed');
    if (dismissed) return;
    
    // Check if we've already suggested this language recently
    const lastSuggestion = localStorage.getItem('airis-last-language-suggestion');
    const lastSuggestionData = lastSuggestion ? JSON.parse(lastSuggestion) : null;
    
    if (lastSuggestionData) {
      const timeDiff = new Date() - new Date(lastSuggestionData.timestamp);
      const daysSince = timeDiff / (1000 * 60 * 60 * 24);
      
      if (daysSince < 7 && lastSuggestionData.language === suggestedLanguage) {
        return; // Don't suggest same language within 7 days
      }
    }
    
    // Get language information
    const languageInfo = this.getLanguageInfo(suggestedLanguage);
    
    // Show suggestion
    this.showLanguageSuggestion({
      language: suggestedLanguage,
      languageInfo,
      country: locationData.country,
      source: locationData.source,
      accuracy: locationData.accuracy,
    });
    
    // Store suggestion info
    localStorage.setItem('airis-last-language-suggestion', JSON.stringify({
      language: suggestedLanguage,
      country: locationData.country,
      timestamp: new Date().toISOString(),
    }));
  }

  // Get language information
  getLanguageInfo(languageCode) {
    const languages = {
      'en': { name: 'English', nativeName: 'English', flag: '🇺🇸' },
      'ko': { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
      'ja': { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
      'zh': { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    };
    
    return languages[languageCode] || languages['en'];
  }

  // Show language suggestion notification
  showLanguageSuggestion(suggestion) {
    // Create suggestion notification
    const notification = document.createElement('div');
    notification.className = `
      fixed top-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-xl max-w-sm
      transform transition-transform duration-500 translate-x-full
    `;
    
    notification.innerHTML = `
      <div class="flex items-start space-x-3">
        <span class="text-2xl">${suggestion.languageInfo.flag}</span>
        <div class="flex-1">
          <h4 class="font-semibold text-sm">Switch to ${suggestion.languageInfo.nativeName}?</h4>
          <p class="text-xs opacity-90 mt-1">
            Detected location: ${suggestion.country}
            <br>Source: ${suggestion.source} (${suggestion.accuracy} accuracy)
          </p>
          <div class="flex space-x-2 mt-2">
            <button 
              class="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-xs transition-colors"
              onclick="switchLanguage('${suggestion.language}')"
            >
              Yes, switch
            </button>
            <button 
              class="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-xs transition-colors"
              onclick="dismissSuggestion()"
            >
              No, thanks
            </button>
          </div>
          <button 
            class="text-xs opacity-75 hover:opacity-100 mt-1 underline"
            onclick="dismissSuggestionPermanently()"
          >
            Don't ask again
          </button>
        </div>
        <button 
          class="text-white opacity-75 hover:opacity-100 p-1"
          onclick="closeSuggestion()"
        >
          ×
        </button>
      </div>
    `;
    
    // Add event handlers
    window.switchLanguage = async (langCode) => {
      try {
        await i18n.changeLanguage(langCode);
        this.closeSuggestionNotification(notification);
        this.showSuccessMessage(`Language switched to ${this.getLanguageInfo(langCode).nativeName}`);
      } catch (error) {
        console.error('Language switch failed:', error);
      }
    };
    
    window.dismissSuggestion = () => {
      this.closeSuggestionNotification(notification);
    };
    
    window.dismissSuggestionPermanently = () => {
      localStorage.setItem('airis-language-suggestion-dismissed', 'true');
      this.closeSuggestionNotification(notification);
    };
    
    window.closeSuggestion = () => {
      this.closeSuggestionNotification(notification);
    };
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        this.closeSuggestionNotification(notification);
      }
    }, 15000);
  }

  // Close suggestion notification
  closeSuggestionNotification(notification) {
    if (document.body.contains(notification)) {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 500);
    }
    
    // Clean up global functions
    delete window.switchLanguage;
    delete window.dismissSuggestion;
    delete window.dismissSuggestionPermanently;
    delete window.closeSuggestion;
  }

  // Show success message
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = `
      fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg
      transform transition-transform duration-300 translate-y-full
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
      toast.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Store location for compliance purposes
  storeLocationForCompliance(locationData) {
    try {
      const complianceData = {
        country: locationData.country,
        region: locationData.region,
        detectedAt: locationData.timestamp,
        source: locationData.source,
        accuracy: locationData.accuracy,
      };
      
      localStorage.setItem('airis-user-location', JSON.stringify(complianceData));
      
      // Trigger compliance check if needed
      if (window.complianceManager) {
        window.complianceManager.detectUserRegion();
      }
    } catch (error) {
      console.warn('Failed to store location for compliance:', error);
    }
  }

  // Cache location data
  cacheLocation(locationData) {
    try {
      const cacheData = {
        ...locationData,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };
      
      localStorage.setItem('airis-location-cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache location:', error);
    }
  }

  // Get cached location
  getCachedLocation() {
    try {
      const cached = localStorage.getItem('airis-location-cache');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Failed to get cached location:', error);
      return null;
    }
  }

  // Check if cache is expired
  isCacheExpired(cachedData) {
    if (!cachedData.expiresAt) return true;
    return new Date() > new Date(cachedData.expiresAt);
  }

  // Handle detection failure
  handleDetectionFailure() {
    console.warn('All location detection methods failed, using default language');
    
    // Store failure info
    localStorage.setItem('airis-location-detection-failed', JSON.stringify({
      timestamp: new Date().toISOString(),
      attempts: 1,
    }));
  }

  // Get current location data
  getCurrentLocation() {
    const cached = this.getCachedLocation();
    return cached && !this.isCacheExpired(cached) ? cached : null;
  }

  // Manually trigger location detection
  async refreshLocation() {
    localStorage.removeItem('airis-location-cache');
    await this.detectLocation();
  }

  // Get location-based recommendations
  getLocationRecommendations() {
    const location = this.getCurrentLocation();
    if (!location) return null;
    
    const country = location.country?.toUpperCase();
    const recommendedLanguages = this.countryLanguageMap[country] || ['en'];
    
    return {
      location,
      recommendedLanguages: recommendedLanguages.map(lang => ({
        code: lang,
        ...this.getLanguageInfo(lang),
      })),
    };
  }
}

// Create and export singleton instance
const geolocationLanguageService = new GeolocationLanguageService();

export default geolocationLanguageService;