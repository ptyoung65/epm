/**
 * Korean-style Material-UI Theme for AIRIS-MON
 * Optimized for Korean UX patterns and business culture
 */

import { createTheme } from '@mui/material/styles';
import { Global, css } from '@emotion/react';

// Korean color semantics (reversed from Western conventions)
const koreanColors = {
  // Primary colors - Korean business-friendly
  primary: {
    main: '#1976D2',      // Professional blue
    light: '#42A5F5',     // Light blue for accents
    dark: '#1565C0',      // Dark blue for emphasis
    contrastText: '#FFFFFF'
  },
  
  // Secondary colors - Korean gold/orange
  secondary: {
    main: '#FF9800',      // Korean traditional orange
    light: '#FFB74D',     // Light orange
    dark: '#F57C00',      // Dark orange
    contrastText: '#000000'
  },
  
  // Status colors (Korean context)
  success: {
    main: '#F44336',      // Red = positive in Korean culture
    light: '#EF5350',     // Light red
    dark: '#D32F2F',      // Dark red
    contrastText: '#FFFFFF'
  },
  
  warning: {
    main: '#4CAF50',      // Green = caution in Korean culture
    light: '#66BB6A',     // Light green
    dark: '#388E3C',      // Dark green
    contrastText: '#000000'
  },
  
  error: {
    main: '#9C27B0',      // Purple for errors (neutral)
    light: '#BA68C8',     // Light purple
    dark: '#7B1FA2',      // Dark purple
    contrastText: '#FFFFFF'
  },
  
  info: {
    main: '#2196F3',      // Blue for information
    light: '#64B5F6',     // Light blue
    dark: '#1976D2',      // Dark blue
    contrastText: '#FFFFFF'
  },
  
  // Background colors
  background: {
    default: '#0A0E1A',   // Dark background like HyperDX
    paper: '#1A1D29',     // Card/paper background
    elevated: '#252833',   // Elevated components
    surface: '#2D3142'     // Surface elements
  },
  
  // Text colors
  text: {
    primary: '#E4E6EA',   // Primary text (light)
    secondary: '#B0B3B8',  // Secondary text (medium)
    disabled: '#6C7B7F',   // Disabled text (dark)
    hint: '#8A8B8D'        // Hint text
  },
  
  // Divider and border colors
  divider: '#3A3B3C',
  
  // Korean-specific colors
  korean: {
    businessHours: '#4CAF50',    // Green for business hours
    afterHours: '#FF9800',       // Orange for after hours
    weekend: '#9C27B0',          // Purple for weekends
    urgent: '#F44336',           // Red for urgent items
    attention: '#FF5722',        // Deep orange for attention
    success: '#F44336',          // Red for success (Korean culture)
    caution: '#4CAF50'           // Green for caution (Korean culture)
  }
};

// Korean typography
const koreanTypography = {
  fontFamily: [
    // Korean fonts
    '"Noto Sans KR"',
    '"Malgun Gothic"',
    '"Apple SD Gothic Neo"',
    '"나눔고딕"',
    'NanumGothic',
    // English fallbacks
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  
  // Korean text sizes (slightly larger for readability)
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em'
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.00833em'
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0em'
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.00735em'
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0em'
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.0075em'
  },
  
  // Body text optimized for Korean
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
    letterSpacing: '0.00938em'
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    letterSpacing: '0.01071em'
  },
  
  // UI text
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: '0.02857em',
    textTransform: 'none' // Don't transform Korean text
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.66,
    letterSpacing: '0.03333em'
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 2.66,
    letterSpacing: '0.08333em',
    textTransform: 'none' // Don't transform Korean text
  }
};

// Korean-specific component overrides
const koreanComponents = {
  // Button customizations
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        padding: '10px 20px',
        fontSize: '0.875rem',
        fontWeight: 500,
        textTransform: 'none',
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
        }
      },
      containedPrimary: {
        background: 'linear-gradient(45deg, #1976D2 30%, #42A5F5 90%)',
        '&:hover': {
          background: 'linear-gradient(45deg, #1565C0 30%, #1976D2 90%)'
        }
      }
    }
  },
  
  // Card customizations (HyperDX style)
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: koreanColors.background.paper,
        borderRadius: 12,
        border: `1px solid ${koreanColors.divider}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          transform: 'translateY(-2px)'
        }
      }
    }
  },
  
  // Paper customizations
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundColor: koreanColors.background.paper,
        backgroundImage: 'none'
      },
      elevation1: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      },
      elevation2: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      },
      elevation4: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
      }
    }
  },
  
  // AppBar customizations
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: koreanColors.background.paper,
        borderBottom: `1px solid ${koreanColors.divider}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }
    }
  },
  
  // Drawer customizations
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundColor: koreanColors.background.default,
        borderRight: `1px solid ${koreanColors.divider}`,
        boxShadow: '4px 0 12px rgba(0,0,0,0.15)'
      }
    }
  },
  
  // List item customizations
  MuiListItem: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        margin: '4px 8px',
        '&.Mui-selected': {
          backgroundColor: koreanColors.primary.main + '20',
          borderLeft: `4px solid ${koreanColors.primary.main}`,
          '&:hover': {
            backgroundColor: koreanColors.primary.main + '30'
          }
        },
        '&:hover': {
          backgroundColor: koreanColors.background.elevated,
          borderRadius: 8
        }
      }
    }
  },
  
  // Chip customizations (status indicators)
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        fontSize: '0.75rem',
        height: 28,
        fontWeight: 500
      },
      colorSuccess: {
        backgroundColor: koreanColors.korean.success + '20',
        color: koreanColors.korean.success,
        border: `1px solid ${koreanColors.korean.success}40`
      },
      colorWarning: {
        backgroundColor: koreanColors.korean.caution + '20',
        color: koreanColors.korean.caution,
        border: `1px solid ${koreanColors.korean.caution}40`
      }
    }
  },
  
  // Table customizations
  MuiTable: {
    styleOverrides: {
      root: {
        backgroundColor: koreanColors.background.paper
      }
    }
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        backgroundColor: koreanColors.background.elevated,
        '& .MuiTableCell-head': {
          fontWeight: 600,
          fontSize: '0.875rem',
          color: koreanColors.text.primary,
          borderBottom: `2px solid ${koreanColors.divider}`
        }
      }
    }
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:hover': {
          backgroundColor: koreanColors.background.elevated
        },
        '&:nth-of-type(even)': {
          backgroundColor: koreanColors.background.default + '40'
        }
      }
    }
  },
  
  // Input customizations
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          backgroundColor: koreanColors.background.paper,
          '& fieldset': {
            borderColor: koreanColors.divider
          },
          '&:hover fieldset': {
            borderColor: koreanColors.primary.light
          },
          '&.Mui-focused fieldset': {
            borderColor: koreanColors.primary.main,
            borderWidth: 2
          }
        }
      }
    }
  },
  
  // Tooltip customizations
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: koreanColors.background.elevated,
        color: koreanColors.text.primary,
        fontSize: '0.75rem',
        border: `1px solid ${koreanColors.divider}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
      }
    }
  }
};

// Create the Korean theme
export const koreanTheme = createTheme({
  palette: {
    mode: 'dark',
    ...koreanColors
  },
  typography: koreanTypography,
  components: koreanComponents,
  
  // Korean-specific spacing
  spacing: 8,
  
  // Shape customizations
  shape: {
    borderRadius: 8
  },
  
  // Transitions optimized for Korean UX (faster, more responsive)
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    }
  },
  
  // Z-index levels
  zIndex: {
    mobileStepper: 1000,
    fab: 1050,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },
  
  // Korean-specific breakpoints (considering Korean screen usage patterns)
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,     // Korean desktop standard
      lg: 1200,    // Korean widescreen
      xl: 1536,    // Korean large displays
    },
  }
});

// Global styles for Korean typography and layout
export const globalStyles = (
  <Global
    styles={css`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
      
      * {
        box-sizing: border-box;
      }
      
      html {
        height: 100%;
        font-size: 16px;
      }
      
      body {
        height: 100%;
        margin: 0;
        padding: 0;
        font-family: ${koreanTypography.fontFamily};
        background-color: ${koreanColors.background.default};
        color: ${koreanColors.text.primary};
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        overflow-x: hidden;
      }
      
      #root {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      /* Custom scrollbar for dark theme */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: ${koreanColors.background.default};
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: ${koreanColors.divider};
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: ${koreanColors.text.disabled};
      }
      
      /* Korean text optimization */
      .korean-text {
        font-family: ${koreanTypography.fontFamily};
        line-height: 1.6;
        word-break: keep-all;
        overflow-wrap: break-word;
      }
      
      /* Status colors for Korean context */
      .status-positive {
        color: ${koreanColors.korean.success};
      }
      
      .status-caution {
        color: ${koreanColors.korean.caution};
      }
      
      .status-urgent {
        color: ${koreanColors.korean.urgent};
      }
      
      .status-attention {
        color: ${koreanColors.korean.attention};
      }
      
      .business-hours {
        color: ${koreanColors.korean.businessHours};
      }
      
      .after-hours {
        color: ${koreanColors.korean.afterHours};
      }
      
      .weekend {
        color: ${koreanColors.korean.weekend};
      }
      
      /* Animation utilities */
      .fade-in {
        animation: fadeIn 0.3s ease-in-out;
      }
      
      .slide-up {
        animation: slideUp 0.25s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      /* HyperDX-style glow effects */
      .glow-effect {
        box-shadow: 0 0 20px rgba(25, 118, 210, 0.3);
        transition: box-shadow 0.3s ease;
      }
      
      .glow-effect:hover {
        box-shadow: 0 0 30px rgba(25, 118, 210, 0.5);
      }
      
      /* Korean loading patterns */
      .loading-dots::after {
        content: '...';
        animation: loadingDots 1.5s infinite;
      }
      
      @keyframes loadingDots {
        0%, 20% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
      }
      
      /* Responsive Korean text scaling */
      @media (max-width: 900px) {
        html {
          font-size: 14px;
        }
        
        .korean-text {
          line-height: 1.7;
        }
      }
      
      @media (max-width: 600px) {
        html {
          font-size: 13px;
        }
        
        .korean-text {
          line-height: 1.8;
        }
      }
      
      /* High contrast mode for accessibility */
      @media (prefers-contrast: high) {
        .status-positive {
          color: #FF6B6B;
          font-weight: 600;
        }
        
        .status-caution {
          color: #51CF66;
          font-weight: 600;
        }
      }
      
      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `}
  />
);

// Korean-specific theme utilities
export const koreanThemeUtils = {
  getStatusColor: (status, korean = true) => {
    if (!korean) {
      // Western conventions
      return {
        success: koreanColors.success.main,
        warning: koreanColors.warning.main,
        error: koreanColors.error.main,
        info: koreanColors.info.main
      }[status] || koreanColors.text.secondary;
    }
    
    // Korean conventions (reversed)
    return {
      success: koreanColors.korean.success,      // Red for success
      warning: koreanColors.korean.caution,      // Green for caution
      error: koreanColors.error.main,            // Purple for error
      info: koreanColors.info.main,              // Blue for info
      urgent: koreanColors.korean.urgent,        // Red for urgent
      attention: koreanColors.korean.attention    // Orange for attention
    }[status] || koreanColors.text.secondary;
  },
  
  getTimeColor: (timeCategory) => {
    return {
      business_hours: koreanColors.korean.businessHours,
      evening: koreanColors.korean.afterHours,
      night: koreanColors.korean.afterHours,
      weekend: koreanColors.korean.weekend
    }[timeCategory] || koreanColors.text.secondary;
  },
  
  formatKoreanNumber: (number) => {
    return new Intl.NumberFormat('ko-KR').format(number);
  },
  
  formatKoreanCurrency: (amount) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  },
  
  formatKoreanPercent: (value) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  }
};

export default koreanTheme;