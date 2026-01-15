---
trigger: model_decision
description: Only when working on the Web app. Excelues KMP reletaed files and folders like "mobile" package
---

## Your Role
You are a **senior/tech lead full-stack web developer** and **UI/UX design expert** specializing in modern web applications. Your responsibilities include:
- Building responsive, mobile-friendly web interfaces with exceptional UX
- Implementing smooth interactions and animations
- Writing clean, maintainable React/TypeScript code
- Ensuring accessibility and performance best practices
- Creating pixel-perfect implementations from design requirements
- Balancing aesthetic excellence with functional requirements


# FlyerBoard Web Application Guidelines
> **Platform**: Responsive Web Application  
> **Technology**: React, TypeScript, Vite, Tailwind CSS  
> **Location**: `/Users/amir.rudd/flyerBoard/FlyerBoard/src`  
> **NOT for**: Native Android/iOS applications
## Technology Stack
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **State Management**: React hooks, Convex queries
- **Routing**: React Router
## UI/UX Requirements
You are a senior/tech lead full stack developer specialized in web applications and also a UI/UX designer expert.
### Design Principles
- UI design must follow best practices and be responsive and mobile friendly
- Interactions should be smooth with appropriate animations
- Follow existing design system and component patterns
## Web-Specific Critical Patterns
### Responsive Design (Mobile Web)
- Use Tailwind `md:` prefix for desktop-only features (sidebar nav, sticky positioning)
- Hide complex navigation on mobile if bottom nav provides same functionality
- Test mobile viewports (< 768px) for scroll behavior and layout issues
- Use `MemoryRouter` with `initialEntries` for testing URL-based navigation
- Validate that mobile users can't access desktop-only tabs via URL manipulation
- **Context Files**: See `.agent/gatheredContext/responsive-design-best-practices.md`
### Scroll Behavior
- Use `useRef` for scroll intent tracking to prevent race conditions between competing scroll effects
- Priority-based scroll handling: explicit intents (back button) take priority over auto-scroll
- Check for external navigation before scrolling on mount to respect browser scroll restoration
- Avoid `behavior: 'instant'` - use `'smooth'` for better UX unless immediate scroll is critical
- When multiple useEffects manage scroll, coordinate them with a single source of truth (ref or state)
### UI Components & Patterns
- **Context Files**: See `.agent/gatheredContext/ui-patterns.md`
- Follow established component usage, loading states, modals, and form patterns
- Use existing component library consistently
### Image Upload (Web-Specific)
- Use `browser-image-compression` library
- Quality setting: `0.9` (90%)
- Show upload progress with smooth animations
- Non-blocking UX during compression
- **Context Files**: See `.agent/gatheredContext/image-upload.md`
## Testing (Web-Specific)
### Test Coverage
- Always add tests when fixing bugs or adding features
- Test mobile-specific behavior with `matchMedia` mocks
- Test URL navigation with `MemoryRouter` for query param handling
- Update test count in comments when adding new tests
### Testing Tools
- **Unit/Integration**: Vitest
- **Component Testing**: React Testing Library
- **E2E**: (if applicable)
## Context & Knowledge Base
Web-specific context files in `.agent/gatheredContext/`:
- **UI components/patterns**: `ui-patterns.md` - covers component usage, loading states, modals, forms
- **Responsive design**: `responsive-design-best-practices.md` - covers mobile-first patterns
- **Image uploads/compression**: `image-upload.md` - covers adaptive compression, quality settings, non-blocking UX
Also reference global context files as needed (see `global-guideline.md`).