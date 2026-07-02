---
trigger: always_on
description: FlyerBoard project architecture overview
---

# Architecture

**Last Updated**: 2026-07-02

## Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (serverless, real-time)
- **Auth**: Descope (OTP-based authentication via OIDC)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Styling**: TailwindCSS + custom design tokens
- **Routing**: React Router v7
- **Testing**: Vitest + React Testing Library

## Project Structure
```
src/
 features/          # Feature modules (ads, auth, dashboard, layout, admin)
 components/        # Shared UI components
 pages/            # Route pages (HomePage, AdDetailPage, etc.)
 context/          # React context (MarketplaceContext, UserSyncContext)
 lib/              # Utilities and helpers
 content/          # Static content (terms, guidelines)
 services/         # External service integrations (notifications)
 hooks/            # Custom React hooks

convex/               # Backend functions and schema
```

## Key Patterns
- **Feature-based organization**: Each feature has its components, tests in its own folder
- **Context for global state**: MarketplaceContext manages filters, categories, ads cache
- **Convex queries/mutations**: Direct from components via hooks (useQuery, useMutation)
- **Client-side caching**: Ads cached by filter combination to prevent reloads
- **Responsive design**: Mobile-first, sidebar collapses on mobile (<768px)
- **Route-based code splitting**: React.lazy() for all routes except HomePage to reduce initial bundle size
- **Persistent app-shell header (2026-07-02)**: `Layout` renders the single `<Header>` instance inside `<main>` before the `<Outlet/>`; it survives route changes and Suspense chunk loads. Pages customise it by registering slots with `useHeaderSlots({ leftNode, centerNode, rightNode, hidden? })` from `src/features/layout/HeaderSlots.tsx` — an external store + `useSyncExternalStore` host, re-registered every render so slot JSX never closes over stale state; registrations stack in mount order (last mounted wins, so inline sub-screens like dashboard→AdDetail override then restore). Never render `<Header>` from a page. Full pattern + gotchas: `ui-patterns.md` → "Header — persistent app shell".
- **PWA support**: Installable app with push notifications
- **Rate limiting**: Mutation-level rate limits via `convex/lib/rateLimit.ts`
- **Image compression**: Client-side WebP compression via browser-image-compression
- **DRY Principle**: Extract duplicated logic into reusable components, functions, or utilities to maintain code quality and reduce maintenance burden
