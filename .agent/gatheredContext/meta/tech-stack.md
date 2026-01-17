---
trigger: always_on
description: Technology stack and dependencies
---

# Tech Stack

**Last Updated**: 2026-01-17

## Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server (using SWC for fast builds)
- **React Router v7** - Client-side routing
- **TailwindCSS** - Utility-first CSS

## Backend
- **Convex** - Serverless backend with real-time subscriptions
- **Descope** - Authentication provider (OTP-based)

## Storage
- **Cloudflare R2** - Object storage for images (S3-compatible)
- **@aws-sdk/client-s3** - S3 client for R2 presigned URLs

## Key Libraries
- **browser-image-compression** - Client-side image compression to WebP
- **react-lazy-load-image-component** - Lazy loading images with fade-in
- **lucide-react** - Icon library
- **sonner** - Toast notifications
- **framer-motion** - Animations
- **react-leaflet** - Maps
- **date-fns** - Date formatting
- **react-markdown** + **remark-gfm** - Markdown rendering
- **clsx** + **tailwind-merge** - Class name utilities
- **Resend** - Email notification delivery
- **web-push** - Push notification delivery

## Testing
- **Vitest** - Test runner
- **@testing-library/react** - Component testing
- **@testing-library/jest-dom** - DOM matchers
- **jsdom** - DOM environment
- **@vitest/coverage-v8** - Coverage reports

## Dev Tools
- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript ESLint** - TS-specific linting
