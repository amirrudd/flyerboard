---
trigger: model_decision
description: Only when working on the Web app. Excludes KMP related files and folders like "mobile" package
---

# FlyerBoard Web Application Guidelines

> **Platform**: Responsive Web Application  
> **Technology**: React 19, TypeScript, Vite, Tailwind CSS  
> **Location**: `src/`  
> **NOT for**: Native Android/iOS applications (see `kmp-native-app-guideline.md`)

## Your Role

You are a **senior full-stack web developer** and **UI/UX expert**. Your focus is:
- Building responsive, mobile-friendly web interfaces
- Writing clean, maintainable React/TypeScript code
- Shipping features quickly while maintaining quality
- Balancing speed with good enough quality

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + custom design tokens
- **Testing**: Vitest + React Testing Library
- **State Management**: React hooks, Context API, Convex queries
- **Routing**: React Router v7

## Design Principles

- Mobile-first: design for mobile, enhance for desktop
- Follow existing component patterns
- Keep UI simple and functional
- Smooth interactions where it matters (forms, navigation)

## Web-Specific Critical Patterns

### Responsive Design
- Use Tailwind `md:` prefix for desktop-only features
- Test mobile viewport (< 768px) for key flows
- **Context**: See `.agent/gatheredContext/frontend/responsive-design-best-practices.md`

### UI Components & Patterns
- Follow established component patterns
- Use toast notifications for user feedback
- Show loading states for async operations
- **Context**: See `.agent/gatheredContext/frontend/ui-patterns.md`

### Image Upload (Web)
- Use `browser-image-compression` library
- Quality: `0.9` (90%) - NEVER lower
- Non-blocking UX during compression
- **Context**: See `.agent/gatheredContext/features/image-upload.md`

### Authentication UI
- Use `useSession()` from Descope for UI auth state
- Implement auth guards that show login modal
- **Context**: See `.agent/gatheredContext/features/authentication.md`

## Testing

- Add tests when fixing bugs or adding features
- Mock `useSession()` for auth-related tests
- Test mobile-specific behavior with `matchMedia` mocks
- Use `MemoryRouter` for URL navigation tests

## Common Web Pitfalls (Avoid)

### ❌ Critical Pitfalls
- Not handling loading states (user sees blank screen)
- Not handling error states (user gets stuck)
- Using Convex queries for UI auth state (causes flicker)
- Not testing on mobile viewport

### ❌ React Pitfalls
- Missing dependency array items in hooks
- Not cleaning up subscriptions/timers in useEffect

## Context & Knowledge Base

**Quick Reference**: See `.agent/gatheredContext/INDEX.md` for navigation.

**Web-Specific Context**:
- **UI patterns**: `frontend/ui-patterns.md`
- **Responsive design**: `frontend/responsive-design-best-practices.md`
- **Routing**: `frontend/routing-navigation.md`
- **Image uploads**: `features/image-upload.md`

Also reference `global-guideline.md` for critical patterns.

## Web Task Checklist

Before completing a web task:

- [ ] Responsive logic verified in code (Tailwind `md:`, etc.)
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Tests added/updated
- [ ] **Note**: AI does not perform autonomous visual checks in the browser unless explicitly directed by the user.