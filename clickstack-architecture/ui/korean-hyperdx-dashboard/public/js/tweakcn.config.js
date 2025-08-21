/**
 * TweakCN Configuration for AIRIS APM
 * 
 * This configuration file manages theme customization using TweakCN
 * Visit https://tweakcn.com to visually edit and generate new themes
 */

const tweakcnConfig = {
  // Theme Presets
  presets: {
    default: {
      name: 'Default',
      description: 'Standard AIRIS APM theme',
      colors: {
        primary: '240 5.9% 10%',
        secondary: '240 4.8% 95.9%',
        accent: '240 4.8% 95.9%',
        background: '0 0% 100%',
        foreground: '240 10% 3.9%',
      }
    },
    ocean: {
      name: 'Ocean',
      description: 'Blue-focused theme for monitoring',
      colors: {
        primary: '217 91% 60%',
        secondary: '215 20% 65%',
        accent: '199 89% 48%',
        background: '210 40% 98%',
        foreground: '222 47% 11%',
      }
    },
    forest: {
      name: 'Forest',
      description: 'Green-focused theme for healthy status',
      colors: {
        primary: '142 76% 36%',
        secondary: '142 43% 89%',
        accent: '161 79% 37%',
        background: '138 16% 97%',
        foreground: '140 61% 11%',
      }
    },
    sunset: {
      name: 'Sunset',
      description: 'Warm theme for critical alerts',
      colors: {
        primary: '25 95% 53%',
        secondary: '28 80% 90%',
        accent: '12 76% 61%',
        background: '20 14% 96%',
        foreground: '24 10% 10%',
      }
    },
    midnight: {
      name: 'Midnight',
      description: 'Dark theme for extended monitoring',
      colors: {
        primary: '217 91% 60%',
        secondary: '215 27% 17%',
        accent: '250 95% 68%',
        background: '222 47% 11%',
        foreground: '210 40% 98%',
      }
    }
  },

  // Component Specific Customizations
  components: {
    // Card styles
    card: {
      default: {
        radius: '0.5rem',
        padding: '1rem',
        shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      },
      compact: {
        radius: '0.375rem',
        padding: '0.75rem',
        shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      large: {
        radius: '0.75rem',
        padding: '1.5rem',
        shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      }
    },

    // Button styles
    button: {
      default: {
        radius: '0.375rem',
        height: '2.5rem',
        padding: '0.5rem 1rem',
      },
      small: {
        radius: '0.25rem',
        height: '2rem',
        padding: '0.25rem 0.75rem',
      },
      large: {
        radius: '0.5rem',
        height: '3rem',
        padding: '0.75rem 1.5rem',
      }
    },

    // Chart colors
    charts: {
      default: ['12 76% 61%', '173 58% 39%', '197 37% 24%', '43 74% 66%', '27 87% 67%'],
      cool: ['217 91% 60%', '199 89% 48%', '188 78% 41%', '176 67% 45%', '169 77% 43%'],
      warm: ['25 95% 53%', '12 76% 61%', '0 84% 60%', '349 88% 62%', '338 79% 57%'],
      monochrome: ['240 5% 26%', '240 5% 34%', '240 5% 42%', '240 5% 49%', '240 5% 65%'],
    }
  },

  // Dashboard Specific Themes
  dashboards: {
    j2ee: {
      primary: '25 95% 53%', // Orange for Java
      charts: ['25 95% 53%', '12 76% 61%', '0 84% 60%', '349 88% 62%', '338 79% 57%']
    },
    was: {
      primary: '217 91% 60%', // Blue for WAS
      charts: ['217 91% 60%', '199 89% 48%', '188 78% 41%', '176 67% 45%', '169 77% 43%']
    },
    exception: {
      primary: '0 84% 60%', // Red for exceptions
      charts: ['0 84% 60%', '349 88% 62%', '338 79% 57%', '328 81% 53%', '315 70% 50%']
    },
    topology: {
      primary: '142 76% 36%', // Green for healthy topology
      charts: ['142 76% 36%', '161 79% 37%', '122 39% 49%', '102 52% 52%', '88 50% 53%']
    },
    alert: {
      primary: '43 96% 56%', // Yellow for alerts
      charts: ['43 96% 56%', '38 92% 50%', '32 95% 44%', '25 95% 53%', '20 90% 48%']
    }
  },

  // Export function to generate CSS variables
  generateCSS: function(preset) {
    const selectedPreset = this.presets[preset] || this.presets.default;
    let css = ':root {\n';
    
    Object.entries(selectedPreset.colors).forEach(([key, value]) => {
      css += `  --${key}: ${value};\n`;
    });
    
    css += '}\n';
    return css;
  },

  // Apply theme function
  applyTheme: function(preset) {
    const root = document.documentElement;
    const selectedPreset = this.presets[preset] || this.presets.default;
    
    Object.entries(selectedPreset.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    
    // Save to localStorage
    localStorage.setItem('tweakcn-theme', preset);
  },

  // Load saved theme
  loadSavedTheme: function() {
    const savedTheme = localStorage.getItem('tweakcn-theme');
    if (savedTheme && this.presets[savedTheme]) {
      this.applyTheme(savedTheme);
      return savedTheme;
    }
    return 'default';
  },

  // Get TweakCN editor URL with current theme
  getTweakcnEditorUrl: function() {
    const root = document.documentElement;
    const currentColors = {
      primary: getComputedStyle(root).getPropertyValue('--primary').trim(),
      secondary: getComputedStyle(root).getPropertyValue('--secondary').trim(),
      accent: getComputedStyle(root).getPropertyValue('--accent').trim(),
      background: getComputedStyle(root).getPropertyValue('--background').trim(),
      foreground: getComputedStyle(root).getPropertyValue('--foreground').trim(),
    };
    
    // Generate URL with current theme (this is a placeholder - actual URL structure may vary)
    const params = new URLSearchParams(currentColors);
    return `https://tweakcn.com?${params.toString()}`;
  }
};

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = tweakcnConfig;
}

// Export for ES6 modules
if (typeof window !== 'undefined') {
  window.tweakcnConfig = tweakcnConfig;
}