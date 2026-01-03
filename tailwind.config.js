const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        '8xl': '1920px',  // For 2K displays - reduces side gaps
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", ...fontFamily.sans],
        display: ["Plus Jakarta Sans", ...fontFamily.sans],
      },
      colors: {
        // Divar-inspired Primary Brand Color (Red)
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',  // Bright red - main brand color
          600: '#dc2626',  // Slightly darker for hover
          700: '#b91c1c',  // Darker red for active/pressed states
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#ef4444', // Main Brand Color (bright red)
        },
        // Neutral Grays (Divar-inspired)
        neutral: {
          50: '#FFFFFF',   // Pure white - backgrounds, cards
          100: '#F5F5F5',  // Light gray - secondary backgrounds
          200: '#DBDBE4',  // Medium light - borders, dividers
          300: '#C4C4D0',  // Subtle borders
          400: '#9CA3AF',  // Disabled states
          500: '#71717A',  // Secondary text (Divar gray)
          600: '#52525B',  // Medium emphasis text
          700: '#3F3F46',  // High emphasis text
          800: '#242428',  // Primary text (Divar dark)
          900: '#18181B',  // Darkest text
        },
        // Accent Blue (for links, info)
        accent: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2385F2',  // Divar blue for links
          600: '#1D6FCC',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#1E3A8A',
        },
        // Semantic Colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#2385F2',

        // Alpha overlays (for shadows, disabled states, etc.)
        'black-alpha': {
          8: 'rgba(0, 0, 0, 0.08)',   // Hover states
          12: 'rgba(0, 0, 0, 0.12)',  // Subtle borders
          24: 'rgba(0, 0, 0, 0.24)',  // Dividers
          32: 'rgba(0, 0, 0, 0.32)',  // Disabled text
          48: 'rgba(0, 0, 0, 0.48)',  // Overlays
          56: 'rgba(0, 0, 0, 0.56)',  // Medium emphasis
          87: 'rgba(0, 0, 0, 0.87)',  // High emphasis
        },
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        "soft": "0 4px 20px -2px rgba(0, 0, 0, 0.05)", // Custom soft shadow
        "glow": "0 0 15px rgba(255, 102, 0, 0.3)", // Brand glow
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "112": "28rem",
        "128": "32rem",
        // Container padding design tokens
        'container-x-mobile': '2%',
        'container-x-tablet': '3%',
        'container-x-desktop': '4%',
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    function ({ addComponents }) {
      addComponents({
        // Proportional padding that scales with viewport
        '.container-padding': {
          'padding-left': 'clamp(1rem, 1.3vw, 2rem)',
          'padding-right': 'clamp(1rem, 1.3vw, 2rem)',
        },
        // Proportional max-width that scales with viewport (capped at 2400px)
        '.content-max-width': {
          'max-width': 'min(88vw, 2400px)',
        },
      })
    }
  ],
};
