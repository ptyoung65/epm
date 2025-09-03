/**
 * Compliance Manager for AIRIS EPM
 * Handles GDPR, CCPA, and other regional compliance requirements
 */

import { EventEmitter } from 'events';

class ComplianceManager extends EventEmitter {
  constructor() {
    super();
    this.userRegion = null;
    this.consentData = new Map();
    this.complianceRules = this.loadComplianceRules();
    this.init();
  }

  // Initialize compliance manager
  async init() {
    try {
      await this.detectUserRegion();
      await this.loadUserConsent();
      this.setupComplianceHandlers();
      console.log('Compliance Manager initialized for region:', this.userRegion);
    } catch (error) {
      console.error('Compliance Manager initialization failed:', error);
    }
  }

  // Detect user's region for compliance requirements
  async detectUserRegion() {
    try {
      // Try multiple methods to detect region
      let region = null;

      // 1. CloudFlare headers
      if (window.CF && window.CF.country) {
        region = window.CF.country;
      }
      
      // 2. Stored user preference
      if (!region) {
        region = localStorage.getItem('airis-user-region');
      }
      
      // 3. Browser language as fallback
      if (!region) {
        const browserLang = navigator.language || navigator.userLanguage;
        const langMap = {
          'en-US': 'US', 'en-CA': 'CA', 'en-GB': 'GB',
          'de-DE': 'DE', 'fr-FR': 'FR', 'es-ES': 'ES',
          'ko-KR': 'KR', 'ja-JP': 'JP', 'zh-CN': 'CN',
        };
        region = langMap[browserLang] || 'US';
      }

      this.userRegion = region;
      localStorage.setItem('airis-user-region', region);
      
      // Emit region detection event
      this.emit('regionDetected', { region, regulations: this.getApplicableRegulations(region) });
      
      return region;
    } catch (error) {
      console.error('Region detection failed:', error);
      this.userRegion = 'US'; // Fallback to US
      return 'US';
    }
  }

  // Load compliance rules configuration
  loadComplianceRules() {
    return {
      GDPR: {
        regions: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'],
        requirements: {
          consentRequired: true,
          rightToAccess: true,
          rightToRectification: true,
          rightToErasure: true,
          rightToPortability: true,
          rightToRestrict: true,
          dataBreachNotification: true,
          privacyByDesign: true,
          cookieConsent: true,
          legalBasis: ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'],
        },
        dataRetention: {
          userProfiles: 365 * 3, // 3 years
          performanceData: 365 * 2, // 2 years
          logs: 90, // 3 months
          cookies: 365, // 1 year
        },
      },
      CCPA: {
        regions: ['US-CA'],
        requirements: {
          consentRequired: false, // Opt-out model
          rightToKnow: true,
          rightToDelete: true,
          rightToOptOut: true,
          rightToNonDiscrimination: true,
          privacyPolicy: true,
          saleDisclosure: true,
        },
        dataRetention: {
          userProfiles: 365 * 2, // 2 years
          performanceData: 365 * 1, // 1 year
          logs: 60, // 2 months
          cookies: 180, // 6 months
        },
      },
      PIPEDA: {
        regions: ['CA'],
        requirements: {
          consentRequired: true,
          purposeLimitation: true,
          dataMinimization: true,
          accuracy: true,
          retention: true,
          security: true,
          openness: true,
          individualAccess: true,
          challengeCompliance: true,
        },
        dataRetention: {
          userProfiles: 365 * 7, // 7 years
          performanceData: 365 * 3, // 3 years
          logs: 90, // 3 months
        },
      },
      PDPA_SG: {
        regions: ['SG'],
        requirements: {
          consentRequired: true,
          notificationRequired: true,
          accessRights: true,
          correctionRights: true,
          dataBreachNotification: true,
          dpoRequired: true,
        },
        dataRetention: {
          userProfiles: 365 * 3, // 3 years
          performanceData: 365 * 1, // 1 year
          logs: 60, // 2 months
        },
      },
      LGPD: {
        regions: ['BR'],
        requirements: {
          consentRequired: true,
          rightToAccess: true,
          rightToCorrection: true,
          rightToErasure: true,
          rightToPortability: true,
          dataBreachNotification: true,
          privacyByDesign: true,
        },
        dataRetention: {
          userProfiles: 365 * 5, // 5 years
          performanceData: 365 * 2, // 2 years
          logs: 90, // 3 months
        },
      },
    };
  }

  // Get applicable regulations for a region
  getApplicableRegulations(region) {
    const applicable = [];
    
    for (const [regulation, config] of Object.entries(this.complianceRules)) {
      if (config.regions.includes(region) || config.regions.includes(`${region.split('-')[0]}`)) {
        applicable.push({ name: regulation, config });
      }
    }
    
    return applicable;
  }

  // Load user consent data
  async loadUserConsent() {
    try {
      const stored = localStorage.getItem('airis-compliance-consent');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.consentData = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load user consent:', error);
    }
  }

  // Save user consent
  async saveUserConsent() {
    try {
      const consentObj = Object.fromEntries(this.consentData);
      localStorage.setItem('airis-compliance-consent', JSON.stringify(consentObj));
      localStorage.setItem('airis-compliance-updated', new Date().toISOString());
    } catch (error) {
      console.error('Failed to save user consent:', error);
    }
  }

  // Check if user consent is required
  isConsentRequired(purpose) {
    const regulations = this.getApplicableRegulations(this.userRegion);
    
    for (const reg of regulations) {
      if (reg.config.requirements.consentRequired) {
        const consent = this.consentData.get(purpose);
        if (!consent || !consent.granted || this.isConsentExpired(consent)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Check if consent is expired
  isConsentExpired(consent) {
    if (!consent.timestamp) return true;
    
    const consentDate = new Date(consent.timestamp);
    const now = new Date();
    const daysDiff = (now - consentDate) / (1000 * 60 * 60 * 24);
    
    // Consent expires after 1 year
    return daysDiff > 365;
  }

  // Request user consent
  async requestConsent(purpose, description, required = false) {
    return new Promise((resolve, reject) => {
      const consentModal = this.createConsentModal(purpose, description, required, (granted) => {
        const consent = {
          purpose,
          granted,
          timestamp: new Date().toISOString(),
          region: this.userRegion,
          required,
        };
        
        this.consentData.set(purpose, consent);
        this.saveUserConsent();
        
        this.emit('consentUpdated', { purpose, consent });
        
        if (granted || !required) {
          resolve(granted);
        } else {
          reject(new Error('Required consent was denied'));
        }
        
        document.body.removeChild(consentModal);
      });
      
      document.body.appendChild(consentModal);
    });
  }

  // Create consent modal
  createConsentModal(purpose, description, required, callback) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    
    const regulations = this.getApplicableRegulations(this.userRegion);
    const regulationNames = regulations.map(r => r.name).join(', ');
    
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md mx-4">
        <div class="flex items-center mb-4">
          <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Privacy Consent ${required ? '(Required)' : '(Optional)'}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              ${regulationNames} compliance
            </p>
          </div>
        </div>
        
        <div class="mb-4">
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">${purpose}</h4>
          <p class="text-sm text-gray-600 dark:text-gray-300">${description}</p>
        </div>
        
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          <p>Your region: ${this.userRegion}</p>
          <p>Applicable regulations: ${regulationNames}</p>
          <p>You can change this preference at any time in settings.</p>
        </div>
        
        <div class="flex space-x-3">
          <button 
            class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            onclick="handleConsent(true)"
          >
            Accept
          </button>
          ${!required ? `
            <button 
              class="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
              onclick="handleConsent(false)"
            >
              Decline
            </button>
          ` : ''}
        </div>
        
        <div class="mt-3 text-center">
          <button 
            class="text-xs text-blue-600 hover:text-blue-800"
            onclick="showPrivacyPolicy()"
          >
            View Privacy Policy
          </button>
        </div>
      </div>
    `;
    
    // Add event handlers
    window.handleConsent = (granted) => {
      delete window.handleConsent;
      delete window.showPrivacyPolicy;
      callback(granted);
    };
    
    window.showPrivacyPolicy = () => {
      window.open('/privacy-policy', '_blank');
    };
    
    return modal;
  }

  // Get user's data rights
  getUserRights() {
    const regulations = this.getApplicableRegulations(this.userRegion);
    const rights = new Set();
    
    for (const reg of regulations) {
      const requirements = reg.config.requirements;
      
      if (requirements.rightToAccess) rights.add('access');
      if (requirements.rightToRectification) rights.add('rectification');
      if (requirements.rightToErasure) rights.add('erasure');
      if (requirements.rightToPortability) rights.add('portability');
      if (requirements.rightToRestrict) rights.add('restriction');
      if (requirements.rightToOptOut) rights.add('opt-out');
      if (requirements.rightToDelete) rights.add('delete');
      if (requirements.rightToKnow) rights.add('know');
    }
    
    return Array.from(rights);
  }

  // Handle data subject request
  async handleDataSubjectRequest(type, userEmail) {
    try {
      const requestId = this.generateRequestId();
      const request = {
        id: requestId,
        type,
        userEmail,
        region: this.userRegion,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      
      // Store request
      const requests = JSON.parse(localStorage.getItem('airis-data-requests') || '[]');
      requests.push(request);
      localStorage.setItem('airis-data-requests', JSON.stringify(requests));
      
      // Process request
      await this.processDataRequest(request);
      
      this.emit('dataRequestSubmitted', request);
      return requestId;
      
    } catch (error) {
      console.error('Data subject request failed:', error);
      throw error;
    }
  }

  // Process data request
  async processDataRequest(request) {
    try {
      switch (request.type) {
        case 'access':
          await this.generateDataExport(request);
          break;
        case 'delete':
        case 'erasure':
          await this.deleteUserData(request);
          break;
        case 'portability':
          await this.generatePortableData(request);
          break;
        case 'opt-out':
          await this.optOutUserData(request);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.type}`);
      }
      
      // Update request status
      const requests = JSON.parse(localStorage.getItem('airis-data-requests') || '[]');
      const requestIndex = requests.findIndex(r => r.id === request.id);
      if (requestIndex >= 0) {
        requests[requestIndex].status = 'completed';
        requests[requestIndex].completedAt = new Date().toISOString();
        localStorage.setItem('airis-data-requests', JSON.stringify(requests));
      }
      
    } catch (error) {
      console.error('Request processing failed:', error);
      throw error;
    }
  }

  // Generate unique request ID
  generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate data export for user
  async generateDataExport(request) {
    const userData = {
      user: {
        email: request.userEmail,
        region: this.userRegion,
        language: localStorage.getItem('airis-preferred-language'),
      },
      consent: Object.fromEntries(this.consentData),
      preferences: {
        theme: localStorage.getItem('airis-theme'),
        notifications: JSON.parse(localStorage.getItem('airis-notifications') || '{}'),
      },
      usage: {
        lastAccess: localStorage.getItem('airis-last-access'),
        sessionCount: localStorage.getItem('airis-session-count'),
      },
      compliance: {
        requests: JSON.parse(localStorage.getItem('airis-data-requests') || '[]'),
        consentHistory: JSON.parse(localStorage.getItem('airis-consent-history') || '[]'),
      },
    };
    
    // Create downloadable file
    const dataBlob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `airis-data-export-${request.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Delete user data
  async deleteUserData(request) {
    // Clear all user data from localStorage
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('airis-')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
    
    // Clear consent data
    this.consentData.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    console.log('User data deleted for request:', request.id);
  }

  // Setup compliance event handlers
  setupComplianceHandlers() {
    // Monitor data collection events
    window.addEventListener('beforeunload', () => {
      this.saveUserConsent();
    });
    
    // Set up periodic consent review
    setInterval(() => {
      this.reviewConsents();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  // Review and cleanup expired consents
  reviewConsents() {
    let hasExpired = false;
    
    for (const [purpose, consent] of this.consentData.entries()) {
      if (this.isConsentExpired(consent)) {
        this.consentData.delete(purpose);
        hasExpired = true;
      }
    }
    
    if (hasExpired) {
      this.saveUserConsent();
      this.emit('consentsExpired');
    }
  }

  // Get compliance status
  getComplianceStatus() {
    const regulations = this.getApplicableRegulations(this.userRegion);
    const status = {
      region: this.userRegion,
      regulations: regulations.map(r => r.name),
      consents: Object.fromEntries(this.consentData),
      rights: this.getUserRights(),
      lastUpdated: localStorage.getItem('airis-compliance-updated'),
    };
    
    return status;
  }
}

// Create global instance
const complianceManager = new ComplianceManager();

export default complianceManager;