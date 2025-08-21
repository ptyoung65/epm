/**
 * TweakCN Theme Loader for AIRIS APM Dashboards
 * Automatically loads and applies saved themes across all dashboards
 */

(function() {
    'use strict';

    // TweakCN Configuration v2.0 - Fixed color application
    console.log('[TweakCN] Loading v2.0 with fixed color presets');
    
    const TweakCNLoader = {
        // Theme storage key
        STORAGE_KEY: 'airis-apm-tweakcn-theme',
        
        // Default theme values
        defaultTheme: {
            // Core colors
            '--background': '0 0% 100%',
            '--foreground': '240 10% 3.9%',
            '--card': '0 0% 100%',
            '--card-foreground': '240 10% 3.9%',
            '--popover': '0 0% 100%',
            '--popover-foreground': '240 10% 3.9%',
            '--primary': '240 5.9% 10%',
            '--primary-foreground': '0 0% 98%',
            '--secondary': '240 4.8% 95.9%',
            '--secondary-foreground': '240 5.9% 10%',
            '--muted': '240 4.8% 95.9%',
            '--muted-foreground': '240 3.8% 46.1%',
            '--accent': '240 4.8% 95.9%',
            '--accent-foreground': '240 5.9% 10%',
            '--destructive': '0 84.2% 60.2%',
            '--destructive-foreground': '0 0% 98%',
            '--border': '240 5.9% 90%',
            '--input': '240 5.9% 90%',
            '--ring': '240 5.9% 10%',
            '--radius': '0.5rem',
            
            // Chart colors
            '--chart-1': '12 76% 61%',
            '--chart-2': '173 58% 39%',
            '--chart-3': '197 37% 24%',
            '--chart-4': '43 74% 66%',
            '--chart-5': '27 87% 67%'
        },

        // Theme presets
        presets: {
            default: {
                name: 'Default',
                description: 'Standard AIRIS APM theme'
            },
            ocean: {
                name: 'Ocean',
                description: 'Blue-focused monitoring theme',
                colors: {
                    '--primary': '217 91% 60%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '215 20% 65%',
                    '--secondary-foreground': '222 47% 11%',
                    '--accent': '199 89% 48%',
                    '--accent-foreground': '0 0% 100%',
                    '--background': '210 40% 98%',
                    '--foreground': '222 47% 11%',
                    '--card': '210 40% 98%',
                    '--card-foreground': '222 47% 11%',
                    '--popover': '210 40% 98%',
                    '--popover-foreground': '222 47% 11%',
                    '--muted': '215 20% 90%',
                    '--muted-foreground': '215 20% 40%',
                    '--destructive': '0 84% 60%',
                    '--destructive-foreground': '0 0% 98%',
                    '--border': '215 20% 85%',
                    '--input': '215 20% 85%',
                    '--ring': '217 91% 60%',
                    '--radius': '0.5rem',
                    '--chart-1': '217 91% 60%',
                    '--chart-2': '199 89% 48%',
                    '--chart-3': '188 78% 41%',
                    '--chart-4': '176 67% 45%',
                    '--chart-5': '169 77% 43%'
                }
            },
            forest: {
                name: 'Forest',
                description: 'Green theme for healthy status',
                colors: {
                    '--primary': '142 76% 36%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '142 43% 89%',
                    '--secondary-foreground': '140 61% 11%',
                    '--accent': '161 79% 37%',
                    '--accent-foreground': '0 0% 100%',
                    '--background': '138 16% 97%',
                    '--foreground': '140 61% 11%',
                    '--card': '138 16% 97%',
                    '--card-foreground': '140 61% 11%',
                    '--popover': '138 16% 97%',
                    '--popover-foreground': '140 61% 11%',
                    '--muted': '142 20% 90%',
                    '--muted-foreground': '142 20% 40%',
                    '--destructive': '0 84% 60%',
                    '--destructive-foreground': '0 0% 98%',
                    '--border': '142 20% 85%',
                    '--input': '142 20% 85%',
                    '--ring': '142 76% 36%',
                    '--radius': '0.5rem',
                    '--chart-1': '142 76% 36%',
                    '--chart-2': '161 79% 37%',
                    '--chart-3': '122 39% 49%',
                    '--chart-4': '102 52% 52%',
                    '--chart-5': '88 50% 53%'
                }
            },
            sunset: {
                name: 'Sunset',
                description: 'Warm theme for alerts',
                colors: {
                    '--primary': '25 95% 53%',
                    '--primary-foreground': '0 0% 100%',
                    '--secondary': '28 80% 90%',
                    '--secondary-foreground': '24 10% 10%',
                    '--accent': '12 76% 61%',
                    '--accent-foreground': '0 0% 100%',
                    '--background': '20 14% 96%',
                    '--foreground': '24 10% 10%',
                    '--card': '20 14% 96%',
                    '--card-foreground': '24 10% 10%',
                    '--popover': '20 14% 96%',
                    '--popover-foreground': '24 10% 10%',
                    '--muted': '25 20% 90%',
                    '--muted-foreground': '25 20% 40%',
                    '--destructive': '0 84% 60%',
                    '--destructive-foreground': '0 0% 98%',
                    '--border': '25 20% 85%',
                    '--input': '25 20% 85%',
                    '--ring': '25 95% 53%',
                    '--radius': '0.5rem',
                    '--chart-1': '25 95% 53%',
                    '--chart-2': '12 76% 61%',
                    '--chart-3': '0 84% 60%',
                    '--chart-4': '349 88% 62%',
                    '--chart-5': '338 79% 57%'
                }
            },
            midnight: {
                name: 'Midnight',
                description: 'Dark theme for extended use',
                colors: {
                    '--primary': '217 91% 60%',
                    '--primary-foreground': '222 47% 11%',
                    '--secondary': '215 27% 17%',
                    '--secondary-foreground': '210 40% 98%',
                    '--accent': '250 95% 68%',
                    '--accent-foreground': '222 47% 11%',
                    '--background': '222 47% 11%',
                    '--foreground': '210 40% 98%',
                    '--card': '222 47% 14%',
                    '--card-foreground': '210 40% 98%',
                    '--popover': '222 47% 14%',
                    '--popover-foreground': '210 40% 98%',
                    '--destructive': '0 62.8% 30.6%',
                    '--destructive-foreground': '210 40% 98%',
                    '--border': '215 27% 25%',
                    '--input': '215 27% 25%',
                    '--ring': '217 91% 60%',
                    '--muted': '215 27% 20%',
                    '--muted-foreground': '215 20% 65%',
                    '--radius': '0.5rem',
                    '--chart-1': '217 91% 60%',
                    '--chart-2': '250 95% 68%',
                    '--chart-3': '280 65% 60%',
                    '--chart-4': '340 75% 55%',
                    '--chart-5': '199 89% 48%'
                }
            }
        },

        // Initialize theme loader
        init: function() {
            this.loadTheme();
            this.setupThemeToggle();
            this.setupKeyboardShortcuts();
            this.injectThemeUI();
        },

        // Load saved theme
        loadTheme: function() {
            const savedTheme = localStorage.getItem(this.STORAGE_KEY);
            if (savedTheme) {
                try {
                    const theme = JSON.parse(savedTheme);
                    console.log('[TweakCN] Loading saved theme from localStorage:', theme);
                    this.applyTheme(theme);
                } catch (e) {
                    console.warn('[TweakCN] Failed to load saved theme:', e);
                    console.log('[TweakCN] Applying default theme as fallback');
                    this.applyTheme(this.defaultTheme);
                }
            } else {
                console.log('[TweakCN] No saved theme found, applying default theme');
                this.applyTheme(this.defaultTheme);
            }
        },

        // Apply theme to document
        applyTheme: function(theme) {
            console.log('[TweakCN] Applying theme:', theme);
            const root = document.documentElement;
            Object.entries(theme).forEach(([key, value]) => {
                // Use !important to override any existing CSS rules
                root.style.setProperty(key, value, 'important');
                console.log(`[TweakCN] Set ${key}: ${value} !important`);
            });
            
            // Force React to re-render by triggering a custom event
            if (window.React) {
                console.log('[TweakCN] Triggering React re-render...');
                setTimeout(() => {
                    // Force all elements with CSS variable classes to recalculate
                    const elementsToUpdate = document.querySelectorAll('.bg-background, .text-foreground, .bg-card, .text-card-foreground, .bg-primary, .text-primary-foreground');
                    elementsToUpdate.forEach(el => {
                        // Force style recalculation
                        el.style.transform = 'translateZ(0)';
                        setTimeout(() => el.style.transform = '', 10);
                    });
                }, 100);
            }
            
            // Verify that the values were actually applied
            setTimeout(() => {
                console.log('[TweakCN] Verification - Current CSS variable values:');
                Object.keys(theme).forEach(key => {
                    const actualValue = getComputedStyle(root).getPropertyValue(key).trim();
                    console.log(`[TweakCN] ${key}: "${actualValue}"`);
                });
            }, 150);
        },

        // Apply preset theme
        applyPreset: function(presetName) {
            console.log(`[TweakCN] Applying preset: ${presetName}`);
            const preset = this.presets[presetName];
            if (!preset) {
                console.error(`[TweakCN] Preset '${presetName}' not found`);
                return;
            }

            // For default preset, use defaultTheme directly
            // For other presets, use their colors
            let theme;
            if (presetName === 'default') {
                theme = { ...this.defaultTheme };
                console.log(`[TweakCN] Using default theme`);
            } else if (preset.colors) {
                // Use preset colors (don't merge with defaultTheme since all colors are defined)
                theme = { ...preset.colors };
                console.log(`[TweakCN] Using preset colors for '${presetName}'`, preset.colors);
            } else {
                // Fallback to default theme
                theme = { ...this.defaultTheme };
                console.log(`[TweakCN] Fallback to default theme for '${presetName}'`);
            }
            
            this.applyTheme(theme);
            this.saveTheme(theme);
            this.showNotification(`Applied ${preset.name} theme`);
            
            // Update color preview after applying theme
            setTimeout(() => this.updateColorPreview(), 100);
        },

        // Save theme to localStorage
        saveTheme: function(theme) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(theme));
        },

        // Get current theme
        getCurrentTheme: function() {
            const root = document.documentElement;
            const theme = {};
            Object.keys(this.defaultTheme).forEach(key => {
                theme[key] = getComputedStyle(root).getPropertyValue(key).trim() || this.defaultTheme[key];
            });
            return theme;
        },

        // Setup theme toggle button
        setupThemeToggle: function() {
            // Check if toggle already exists
            if (document.getElementById('tweakcn-toggle')) return;

            const toggle = document.createElement('button');
            toggle.id = 'tweakcn-toggle';
            toggle.className = 'fixed bottom-4 left-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-shadow';
            toggle.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    <circle cx="12" cy="12" r="4"/>
                </svg>
            `;
            toggle.title = 'TweakCN Theme Settings (Ctrl+Shift+T)';
            toggle.onclick = () => this.toggleThemePanel();
            
            document.body.appendChild(toggle);
        },

        // Toggle theme panel
        toggleThemePanel: function() {
            const panel = document.getElementById('tweakcn-panel');
            if (panel) {
                panel.remove();
            } else {
                this.injectThemeUI();
            }
        },

        // Inject theme UI panel
        injectThemeUI: function() {
            // Check if panel already exists
            if (document.getElementById('tweakcn-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'tweakcn-panel';
            panel.className = 'fixed top-4 right-4 z-50 w-80 rounded-lg shadow-xl border p-4';
            panel.style.cssText = `
                background: hsl(var(--card, 0 0% 100%));
                color: hsl(var(--card-foreground, 240 10% 3.9%));
                border-color: hsl(var(--border, 240 5.9% 90%));
            `;
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-size: 18px; font-weight: 600;">TweakCN Themes v2.0</h3>
                    <button onclick="TweakCNLoader.toggleThemePanel()" style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground, 240 3.8% 46.1%));">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground, 240 3.8% 46.1%)); margin-bottom: 8px;">
                        현재 적용된 배경색: <span id="current-bg-display" style="font-family: monospace;">-</span>
                    </div>
                    <div style="height: 20px; border: 1px solid hsl(var(--border, 240 5.9% 90%)); border-radius: 4px;" id="color-preview"></div>
                </div>
                <div style="display: grid; gap: 8px;">
                    ${Object.entries(this.presets).map(([key, preset]) => `
                        <button onclick="TweakCNLoader.applyPreset('${key}')" 
                                style="width: 100%; text-align: left; padding: 12px; border: 1px solid hsl(var(--border, 240 5.9% 90%)); border-radius: 6px; background: hsl(var(--card, 0 0% 100%)); color: hsl(var(--card-foreground, 240 10% 3.9%)); cursor: pointer; transition: all 0.2s;" 
                                onmouseover="this.style.backgroundColor='hsl(var(--accent, 240 4.8% 95.9%))'" 
                                onmouseout="this.style.backgroundColor='hsl(var(--card, 0 0% 100%))'">
                            <div style="font-weight: 500;">${preset.name}</div>
                            <div style="font-size: 12px; color: hsl(var(--muted-foreground, 240 3.8% 46.1%));">${preset.description}</div>
                        </button>
                    `).join('')}
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid hsl(var(--border, 240 5.9% 90%));">
                    <button onclick="TweakCNLoader.debugCurrentTheme()" 
                            style="width: 100%; padding: 8px; border: 1px solid hsl(var(--border, 240 5.9% 90%)); border-radius: 4px; background: hsl(var(--secondary, 240 4.8% 95.9%)); color: hsl(var(--secondary-foreground, 240 5.9% 10%)); cursor: pointer; margin-bottom: 8px;">
                        🔍 현재 테마 디버그 정보 출력
                    </button>
                    <button onclick="window.open('/test-simple-theme.html', '_blank')" 
                            style="width: 100%; padding: 8px; border: 1px solid hsl(var(--border, 240 5.9% 90%)); border-radius: 4px; background: hsl(var(--secondary, 240 4.8% 95.9%)); color: hsl(var(--secondary-foreground, 240 5.9% 10%)); cursor: pointer;">
                        🧪 테스트 페이지 열기
                    </button>
                </div>
            `;
            
            document.body.appendChild(panel);
            this.updateColorPreview();
        },

        // Setup keyboard shortcuts
        setupKeyboardShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+Shift+T to toggle theme panel
                if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                    e.preventDefault();
                    this.toggleThemePanel();
                }
                
                // Ctrl+Shift+D to toggle dark mode
                if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                    e.preventDefault();
                    this.toggleDarkMode();
                }
            });
        },

        // Toggle dark mode
        toggleDarkMode: function() {
            const isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                document.documentElement.classList.remove('dark');
                this.applyPreset('default');
            } else {
                document.documentElement.classList.add('dark');
                this.applyPreset('midnight');
            }
        },

        // Show notification
        showNotification: function(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 50;
                padding: 8px 16px;
                background: hsl(var(--primary, 240 5.9% 10%));
                color: hsl(var(--primary-foreground, 0 0% 98%));
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                transition: opacity 0.3s;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        },

        // Debug current theme
        debugCurrentTheme: function() {
            const root = document.documentElement;
            const computedStyle = getComputedStyle(root);
            
            console.group('[TweakCN] 현재 테마 디버그 정보');
            console.log('='.repeat(50));
            
            const variables = Object.keys(this.defaultTheme);
            variables.forEach(varName => {
                const value = computedStyle.getPropertyValue(varName).trim();
                const inlineValue = root.style.getPropertyValue(varName).trim();
                console.log(`${varName}:`);
                console.log(`  computed: "${value}"`);
                console.log(`  inline: "${inlineValue}"`);
                console.log(`  color: hsl(${value})`);
            });
            
            console.log('='.repeat(50));
            console.log('LocalStorage 저장된 테마:', localStorage.getItem(this.STORAGE_KEY));
            console.groupEnd();
            
            this.updateColorPreview();
            this.showNotification('디버그 정보를 콘솔에 출력했습니다 (F12)');
        },

        // Update color preview in panel
        updateColorPreview: function() {
            const bgDisplay = document.getElementById('current-bg-display');
            const colorPreview = document.getElementById('color-preview');
            
            if (bgDisplay && colorPreview) {
                const root = document.documentElement;
                const bgValue = getComputedStyle(root).getPropertyValue('--background').trim();
                const hslColor = `hsl(${bgValue})`;
                
                bgDisplay.textContent = bgValue;
                colorPreview.style.backgroundColor = hslColor;
            }
        }
    };

    // Initialize on DOM ready - but wait for React to render
    function initTweakCN() {
        // If React is present, wait a bit for it to render
        if (window.React && document.getElementById('root')) {
            console.log('[TweakCN] React detected, waiting for initial render...');
            setTimeout(() => {
                TweakCNLoader.init();
            }, 500);
        } else {
            TweakCNLoader.init();
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTweakCN);
    } else {
        initTweakCN();
    }

    // Export to global scope
    window.TweakCNLoader = TweakCNLoader;
})();