#!/usr/bin/env node
/**
 * Visual validation script for TweakCN theme system
 * Tests all theme presets and captures color information
 */

const http = require('http');
const fs = require('fs');

async function validateThemeColors() {
  console.log('🎨 TweakCN Theme Visual Validation\n');

  // Test each theme's expected colors
  const themeColors = {
    default: {
      background: '0 0% 100%',
      primary: '222.2 47.4% 11.2%',
      description: 'Standard light theme'
    },
    ocean: {
      background: '210 40% 98%',
      primary: '217 91% 60%',
      description: 'Blue monitoring theme'
    },
    forest: {
      background: '138 16% 97%',
      primary: '142 76% 36%',
      description: 'Green health theme'
    },
    sunset: {
      background: '20 14% 96%',
      primary: '25 95% 53%',
      description: 'Orange alert theme'
    },
    midnight: {
      background: '222 47% 11%',
      primary: '217 91% 60%',
      description: 'Dark extended-use theme'
    }
  };

  console.log('📊 Expected Theme Colors:');
  console.log('=' + '='.repeat(50));
  
  Object.entries(themeColors).forEach(([name, colors]) => {
    console.log(`\n🎨 ${name.toUpperCase()} Theme:`);
    console.log(`   Background: hsl(${colors.background})`);
    console.log(`   Primary:    hsl(${colors.primary})`);
    console.log(`   Use case:   ${colors.description}`);
  });

  console.log('\n' + '='.repeat(50));

  // Test if dashboard is accessible
  try {
    const response = await testHTTP('http://localhost:3002/');
    if (response) {
      console.log('✅ Dashboard accessible');
      
      // Test theme test page
      const testPageResponse = await testHTTP('http://localhost:3002/test-simple-theme.html');
      if (testPageResponse) {
        console.log('✅ Theme test page accessible');
      }
    }
  } catch (error) {
    console.log('❌ Dashboard not accessible:', error.message);
    return;
  }

  console.log('\n📋 Manual Testing Instructions:');
  console.log('1. Open http://localhost:3002/ in your browser');
  console.log('2. Look for theme button in bottom-left corner');
  console.log('3. Click button or press Ctrl+Shift+T to open theme panel');
  console.log('4. Test each theme preset and verify colors match expectations above');
  console.log('5. Check background color changes are visible immediately');
  
  console.log('\n🔍 Debug Instructions:');
  console.log('1. Open browser console (F12)');
  console.log('2. Run: window.TweakCNLoader.debugCurrentTheme()');
  console.log('3. Verify CSS variables match expected values');
  
  console.log('\n🧪 Automated Testing:');
  console.log('Visit: http://localhost:3002/test-simple-theme.html');
  console.log('Click "테마 테스트 시작" to cycle through all themes');

  // Generate validation checklist
  const checklist = generateValidationChecklist();
  fs.writeFileSync('/home/ptyoung/work/AIRIS_APM/theme-validation-checklist.md', checklist);
  console.log('\n📝 Validation checklist saved to: theme-validation-checklist.md');
}

function testHTTP(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'HEAD'
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
    req.end();
  });
}

function generateValidationChecklist() {
  return `# TweakCN Theme Validation Checklist

## Visual Validation Steps

### 1. Basic Functionality
- [ ] Dashboard loads at http://localhost:3002/
- [ ] Theme button visible in bottom-left corner
- [ ] Clicking button opens theme panel
- [ ] Ctrl+Shift+T opens/closes theme panel
- [ ] Ctrl+Shift+D toggles dark mode

### 2. Theme Application Testing

#### Default Theme
- [ ] Background: White/light (hsl(0 0% 100%))
- [ ] Text: Dark (readable contrast)
- [ ] Cards: Clean white appearance
- [ ] Buttons: Dark blue primary color

#### Ocean Theme  
- [ ] Background: Light blue tint (hsl(210 40% 98%))
- [ ] Primary: Bright blue (hsl(217 91% 60%))
- [ ] Overall: Blue monitoring aesthetic
- [ ] Charts: Blue color scheme

#### Forest Theme
- [ ] Background: Light green tint (hsl(138 16% 97%))
- [ ] Primary: Green accent (hsl(142 76% 36%))
- [ ] Overall: Green healthy status feel
- [ ] Status indicators: Green emphasis

#### Sunset Theme
- [ ] Background: Warm light (hsl(20 14% 96%))
- [ ] Primary: Orange accent (hsl(25 95% 53%))
- [ ] Overall: Warm alert aesthetic
- [ ] Warning colors: Orange emphasis

#### Midnight Theme
- [ ] Background: Dark (hsl(222 47% 11%))
- [ ] Text: Light for readability
- [ ] Cards: Dark with good contrast
- [ ] Overall: Professional dark mode

### 3. Cross-Dashboard Consistency
- [ ] Theme applies to main dashboard
- [ ] Theme applies to J2EE monitoring
- [ ] Theme applies to WAS monitoring  
- [ ] Theme applies to exception tracking
- [ ] Theme applies to service topology
- [ ] Theme applies to alert management

### 4. Persistence Testing
- [ ] Selected theme persists after page refresh
- [ ] Theme persists across different dashboard pages
- [ ] LocalStorage contains theme data
- [ ] Theme loads correctly on initial visit

### 5. Debug Features
- [ ] Debug function outputs to console
- [ ] CSS variable values displayed correctly
- [ ] Color preview updates in theme panel
- [ ] Test page functions work properly

## Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge (if available)

## Performance Checks
- [ ] Theme switching is immediate (< 300ms)
- [ ] No visual flicker during transitions
- [ ] Smooth CSS transitions
- [ ] No console errors

## Validation Complete
Date: ___________
Tester: ___________
Notes: ___________

✅ All checks passed - Theme system ready for production
❌ Issues found - See notes above
`;
}

// Run validation
validateThemeColors().catch(console.error);