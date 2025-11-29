---
trigger: always_on
description: FlyerBoard project architecture overview
---

# Architecture

## Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (serverless, real-time)
- **Auth**: Convex Auth (anonymous auth enabled)
- **Styling**: TailwindCSS + custom design tokens
- **Routing**: React Router v7
- **Testing**: Vitest + React Testing Library

## Project Structure
```
src/
 features/          # Feature modules (ads, auth, dashboard, layout, reviews)
 components/        # Shared UI components
 pages/            # Route pages (HomePage, AdDetailPage, etc.)
 context/          # React context (MarketplaceContext)
 lib/              # Utilities and helpers
 content/          # Static content (terms, guidelines)

convex/               # Backend functions and schema
```

## Key Patterns
- **Feature-based organization**: Each feature has its components, tests in its own folder
- **Context for global state**: MarketplaceContext manages filters, categories, ads cache
- **Convex queries/mutations**: Direct from components via hooks (useQuery, useMutation)
- **Client-side caching**: Ads cached by filter combination to prevent reloads
- **Responsive design**: Mobile-first, sidebar collapses on mobile (<768px)
