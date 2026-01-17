const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: 'class',
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "primary-bright": {
          DEFAULT: "hsl(var(--primary-bright))",
        },
        // Legacy neutral for backward compatibility during migration
        neutral: {
          50: '#FFFFFF',
          100: '#F5F5F5',
          200: '#DBDBE4',
          300: '#C4C4D0',
          400: '#9CA3AF',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#242428',
          900: '#18181B',
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
        "14": "3.5rem",   // Standard h-14 equivalent for fixed positioning
        "18": "4.5rem",
        "21": "5.0625rem", // Supported sticky offset: 81px (57px Header + 24px Top Padding)
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
        // Mobile: 0.5rem (8px), scales up on larger screens
        '.container-padding': {
          'padding-left': 'clamp(0.5rem, 1.3vw, 2rem)',
          'padding-right': 'clamp(0.5rem, 1.3vw, 2rem)',
          '@media (min-width: 768px)': {
            'padding-left': 'clamp(1rem, 1.3vw, 2rem)',
            'padding-right': 'clamp(1rem, 1.3vw, 2rem)',
          },
        },
        // Proportional max-width that scales with viewport (capped at 2400px)
        // Mobile: 96vw (4% total margins), Desktop: 88vw (12% total margins)
        '.content-max-width': {
          'max-width': 'min(96vw, 2400px)',
          '@media (min-width: 768px)': {
            'max-width': 'min(88vw, 2400px)',
          },
        },
        // Optimal reading width for static content pages
        '.content-width-reading': {
          'max-width': '960px',
        },
      })
    }
  ],
};
