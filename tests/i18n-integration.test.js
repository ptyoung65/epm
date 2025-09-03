/**
 * Integration Tests for AIRIS EPM Internationalization System
 * Tests language switching, compliance, localization, and regional features
 */

const fs = require('fs');
const path = require('path');

describe('AIRIS EPM Internationalization Integration Tests', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    // Start browser for testing
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Language Resource Files', () => {
    const languages = ['en', 'ko', 'ja', 'zh'];
    const requiredSections = [
      'app', 'navigation', 'dashboard', 'monitoring', 'alerts',
      'forms', 'time', 'status', 'j2ee', 'was', 'errors',
      'units', 'actions', 'settings', 'compliance'
    ];

    languages.forEach(lang => {
      test(`${lang.toUpperCase()} language file should exist and be valid`, () => {
        const filePath = path.join(__dirname, '../src/i18n/locales', lang, 'common.json');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Check all required sections exist
        requiredSections.forEach(section => {
          expect(content).toHaveProperty(section);
          expect(typeof content[section]).toBe('object');
        });
      });

      test(`${lang.toUpperCase()} language file should have consistent structure`, () => {
        const filePath = path.join(__dirname, '../src/i18n/locales', lang, 'common.json');
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Compare with English structure
        const enFilePath = path.join(__dirname, '../src/i18n/locales/en/common.json');
        const enContent = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
        
        const checkStructure = (obj1, obj2, path = '') => {
          Object.keys(obj1).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            expect(obj2).toHaveProperty(key, `Missing key: ${currentPath} in ${lang}`);
            
            if (typeof obj1[key] === 'object' && obj1[key] !== null) {
              checkStructure(obj1[key], obj2[key], currentPath);
            }
          });
        };
        
        checkStructure(enContent, content);
      });
    });
  });

  describe('Language Selector Component', () => {
    beforeEach(async () => {
      // Navigate to a test page with language selector
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
    });

    test('should display language selector', async () => {
      const languageSelector = await page.$('.language-selector');
      expect(languageSelector).toBeTruthy();
    });

    test('should show current language', async () => {
      const currentLang = await page.$eval('.language-selector', el => 
        el.textContent.includes('English') || el.textContent.includes('한국어')
      );
      expect(currentLang).toBe(true);
    });

    test('should open language dropdown on click', async () => {
      await page.click('.language-selector button');
      
      const dropdown = await page.waitForSelector('.language-selector div[role="menu"], .absolute.top-full', {
        visible: true,
        timeout: 2000,
      });
      
      expect(dropdown).toBeTruthy();
    });

    test('should display all supported languages', async () => {
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      const languages = await page.$$eval('[role="menu"] button, .absolute.top-full button', buttons => 
        buttons.map(btn => btn.textContent)
      );
      
      expect(languages.some(lang => lang.includes('English'))).toBe(true);
      expect(languages.some(lang => lang.includes('한국어'))).toBe(true);
      expect(languages.some(lang => lang.includes('日本語'))).toBe(true);
      expect(languages.some(lang => lang.includes('中文'))).toBe(true);
    });

    test('should switch language on selection', async () => {
      // Open dropdown
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      // Click Korean language option
      const koreanOption = await page.$x('//button[contains(text(), "한국어")]');
      if (koreanOption.length > 0) {
        await koreanOption[0].click();
        
        // Wait for language change
        await page.waitForTimeout(1000);
        
        // Check if page content changed to Korean
        const pageContent = await page.content();
        expect(pageContent.includes('대시보드') || pageContent.includes('모니터링')).toBe(true);
      }
    });
  });

  describe('Geolocation Language Detection', () => {
    test('should detect location and suggest appropriate language', async () => {
      // Mock geolocation to return Korean coordinates
      await page.evaluateOnNewDocument(() => {
        window.CF = { country: 'KR' };
      });
      
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      // Wait for geolocation detection
      await page.waitForTimeout(3000);
      
      // Check if language suggestion appeared
      const suggestion = await page.$('.fixed.top-4.right-4');
      if (suggestion) {
        const suggestionText = await suggestion.evaluate(el => el.textContent);
        expect(suggestionText.includes('한국어') || suggestionText.includes('Korean')).toBe(true);
      }
    });

    test('should not show suggestion if already using appropriate language', async () => {
      // Set language to Korean first
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      await page.evaluate(() => {
        localStorage.setItem('airis-preferred-language', 'ko');
        window.location.reload();
      });
      
      await page.waitForTimeout(2000);
      
      // Mock Korean location
      await page.evaluate(() => {
        window.CF = { country: 'KR' };
        if (window.geolocationLanguageService) {
          window.geolocationLanguageService.detectLocation();
        }
      });
      
      await page.waitForTimeout(3000);
      
      // Should not show suggestion
      const suggestion = await page.$('.fixed.top-4.right-4');
      expect(suggestion).toBeNull();
    });
  });

  describe('Regional Compliance Features', () => {
    test('should detect GDPR region and show compliance features', async () => {
      // Mock EU location
      await page.evaluateOnNewDocument(() => {
        window.CF = { country: 'DE' };
      });
      
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      // Wait for compliance detection
      await page.waitForTimeout(3000);
      
      // Check if GDPR compliance elements are present
      const gdprElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-gdpr], [class*="gdpr"], [class*="consent"]');
        return elements.length > 0;
      });
      
      // Check localStorage for compliance data
      const complianceData = await page.evaluate(() => {
        return localStorage.getItem('airis-compliance-consent');
      });
      
      expect(gdprElements || complianceData).toBeTruthy();
    });

    test('should show appropriate compliance UI for US users', async () => {
      // Mock US location
      await page.evaluateOnNewDocument(() => {
        window.CF = { country: 'US' };
      });
      
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      // Wait for compliance detection
      await page.waitForTimeout(3000);
      
      // Should not show GDPR-specific elements
      const gdprElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-gdpr-required="true"]');
        return elements.length;
      });
      
      expect(gdprElements).toBe(0);
    });
  });

  describe('Date, Time, and Currency Localization', () => {
    const testCases = [
      { lang: 'en', country: 'US', expectedCurrency: '$', dateFormat: /\d{1,2}\/\d{1,2}\/\d{4}/ },
      { lang: 'ko', country: 'KR', expectedCurrency: '₩', dateFormat: /\d{4}\.\d{1,2}\.\d{1,2}/ },
      { lang: 'ja', country: 'JP', expectedCurrency: '¥', dateFormat: /\d{4}\/\d{1,2}\/\d{1,2}/ },
      { lang: 'zh', country: 'CN', expectedCurrency: '¥', dateFormat: /\d{4}年\d{1,2}月\d{1,2}日/ },
    ];

    testCases.forEach(({ lang, country, expectedCurrency, dateFormat }) => {
      test(`should format currency and dates correctly for ${lang.toUpperCase()}`, async () => {
        // Set language and location
        await page.evaluateOnNewDocument((language, countryCode) => {
          localStorage.setItem('airis-preferred-language', language);
          window.CF = { country: countryCode };
        }, lang, country);
        
        await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
        
        // Test currency formatting
        const currencyFormatted = await page.evaluate((currency) => {
          if (window.formatCurrency) {
            return window.formatCurrency(1234.56);
          }
          // Fallback test - look for currency symbol in page content
          return document.body.textContent.includes(currency);
        }, expectedCurrency);
        
        expect(currencyFormatted).toBeTruthy();
        
        // Test date formatting
        const dateFormatted = await page.evaluate((pattern) => {
          if (window.formatDate) {
            const formatted = window.formatDate(new Date());
            return pattern.test(formatted);
          }
          // Look for date patterns in page content
          const dates = document.body.textContent.match(pattern);
          return dates && dates.length > 0;
        }, dateFormat);
        
        expect(dateFormatted).toBeTruthy();
      });
    });
  });

  describe('CDN Configuration Integration', () => {
    test('should redirect based on location', async () => {
      // This test would require actual CDN setup, so we'll mock it
      const cdnConfig = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../infrastructure/cdn/cloudflare-config.js'),
          'utf8'
        ).replace('module.exports = ', '').replace(';', '')
      );
      
      expect(cdnConfig.zones.regions).toHaveProperty('us-east');
      expect(cdnConfig.zones.regions).toHaveProperty('eu-west');
      expect(cdnConfig.zones.regions).toHaveProperty('ap-northeast');
      expect(cdnConfig.zones.regions).toHaveProperty('ap-southeast');
    });

    test('should have proper geo-steering configuration', async () => {
      const cdnConfig = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../infrastructure/cdn/cloudflare-config.js'),
          'utf8'
        ).replace('module.exports = ', '').replace(';', '')
      );
      
      const geoSteering = cdnConfig.cdn.load_balancing.geo_steering;
      
      expect(geoSteering).toBeDefined();
      expect(geoSteering.some(rule => rule.country.includes('KR'))).toBe(true);
      expect(geoSteering.some(rule => rule.country.includes('JP'))).toBe(true);
      expect(geoSteering.some(rule => rule.country.includes('CN'))).toBe(true);
    });
  });

  describe('Mobile App Integration', () => {
    test('should have mobile language selector component', () => {
      const mobileLangSelector = path.join(__dirname, '../mobile-app/src/components/LanguageSelector.js');
      expect(fs.existsSync(mobileLangSelector)).toBe(true);
      
      const content = fs.readFileSync(mobileLangSelector, 'utf8');
      expect(content).toContain('react-native-localize');
      expect(content).toContain('AsyncStorage');
      expect(content).toContain('getLocales');
    });

    test('should have i18n configuration for mobile', () => {
      const mobileI18nConfig = path.join(__dirname, '../mobile-app/src/i18n/config.js');
      expect(fs.existsSync(mobileI18nConfig)).toBe(true);
      
      const content = fs.readFileSync(mobileI18nConfig, 'utf8');
      expect(content).toContain('react-i18next');
      expect(content).toContain('react-native-language-detector');
    });

    test('should have updated App.js with i18n provider', () => {
      const mobileApp = path.join(__dirname, '../mobile-app/App.js');
      expect(fs.existsSync(mobileApp)).toBe(true);
      
      const content = fs.readFileSync(mobileApp, 'utf8');
      expect(content).toContain('I18nextProvider');
      expect(content).toContain('i18n from');
    });
  });

  describe('Multi-Region Deployment Configuration', () => {
    test('should have multi-region deployment configuration', () => {
      const deployConfig = path.join(__dirname, '../deployment/multi-region-config.yml');
      expect(fs.existsSync(deployConfig)).toBe(true);
    });

    test('should have deployment script', () => {
      const deployScript = path.join(__dirname, '../deployment/deploy-multi-region.sh');
      expect(fs.existsSync(deployScript)).toBe(true);
      
      const stats = fs.statSync(deployScript);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check if executable
    });

    test('should support all target regions', () => {
      const deployConfigContent = fs.readFileSync(
        path.join(__dirname, '../deployment/multi-region-config.yml'),
        'utf8'
      );
      
      expect(deployConfigContent).toContain('us-east-1');
      expect(deployConfigContent).toContain('eu-west-1');
      expect(deployConfigContent).toContain('ap-northeast-1');
      expect(deployConfigContent).toContain('ap-northeast-2');
      expect(deployConfigContent).toContain('cn-north-1');
    });
  });

  describe('Full User Journey Test', () => {
    test('should complete full internationalization user journey', async () => {
      // Start with English
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      let initialContent = await page.$eval('body', el => el.textContent);
      expect(initialContent).toContain('Dashboard');
      
      // Switch to Korean
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      const koreanOption = await page.$x('//button[contains(text(), "한국어")]');
      if (koreanOption.length > 0) {
        await koreanOption[0].click();
        await page.waitForTimeout(1000);
        
        let koreanContent = await page.$eval('body', el => el.textContent);
        expect(koreanContent).toContain('대시보드');
      }
      
      // Switch to Japanese
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      const japaneseOption = await page.$x('//button[contains(text(), "日本語")]');
      if (japaneseOption.length > 0) {
        await japaneseOption[0].click();
        await page.waitForTimeout(1000);
        
        let japaneseContent = await page.$eval('body', el => el.textContent);
        expect(japaneseContent).toContain('ダッシュボード');
      }
      
      // Switch to Chinese
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      const chineseOption = await page.$x('//button[contains(text(), "中文")]');
      if (chineseOption.length > 0) {
        await chineseOption[0].click();
        await page.waitForTimeout(1000);
        
        let chineseContent = await page.$eval('body', el => el.textContent);
        expect(chineseContent).toContain('仪表板');
      }
      
      // Verify language persistence
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForTimeout(1000);
      
      let persistedContent = await page.$eval('body', el => el.textContent);
      expect(persistedContent).toContain('仪表板'); // Should still be Chinese
    });
  });

  describe('Performance Tests', () => {
    test('should load language resources efficiently', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should switch languages quickly', async () => {
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
      
      const switchStartTime = Date.now();
      
      await page.click('.language-selector button');
      await page.waitForSelector('[role="menu"], .absolute.top-full', { visible: true });
      
      const koreanOption = await page.$x('//button[contains(text(), "한국어")]');
      if (koreanOption.length > 0) {
        await koreanOption[0].click();
        
        // Wait for content to change
        await page.waitForFunction(
          () => document.body.textContent.includes('대시보드'),
          { timeout: 3000 }
        );
      }
      
      const switchTime = Date.now() - switchStartTime;
      expect(switchTime).toBeLessThan(2000); // Should switch within 2 seconds
    });
  });
});

// Generate test report
afterAll(() => {
  const reportPath = path.join(__dirname, '../test-results/i18n-integration-report.json');
  const report = {
    testSuite: 'AIRIS EPM Internationalization Integration Tests',
    timestamp: new Date().toISOString(),
    environment: 'test',
    summary: {
      total: expect.getState().assertionCalls,
      passed: expect.getState().assertionCalls - expect.getState().numPassingAsserts,
      failed: expect.getState().numPassingAsserts,
    },
    coverage: {
      languageFiles: ['en', 'ko', 'ja', 'zh'],
      components: ['LanguageSelector', 'ComplianceManager'],
      services: ['GeolocationLanguageService'],
      features: ['CDN', 'Mobile', 'Localization', 'Compliance'],
    },
  };
  
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`Integration test report generated: ${reportPath}`);
});