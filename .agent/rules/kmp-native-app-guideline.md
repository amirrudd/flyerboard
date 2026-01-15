---
trigger: model_decision
description: Only when working on mobile platform folders like "mobile" and "mobile-api" packages.
---

# FlyerBoard KMP Native App Guidelines

> **Platform**: Android & iOS Native Applications  
> **Technology**: Kotlin Multiplatform + Compose Multiplatform  
> **Location**: `mobile/`  
> **NOT for**: Responsive web app (see `web-app-guideline.md`)

## Your Role

You are a **senior mobile developer** specializing in Kotlin Multiplatform. Your focus is:
- Building native Android and iOS apps using KMP and Compose Multiplatform
- Writing shared business logic in Kotlin
- Shipping features quickly while maintaining quality
- Following platform conventions where they matter

## Technology Stack

- **Framework**: Kotlin Multiplatform (KMP)
- **UI**: Compose Multiplatform
- **DI**: Koin
- **Navigation**: Decompose
- **Languages**: Kotlin (shared), Swift (iOS-specific when needed)

## Project Structure

```
mobile/
├── shared/
│   └── src/
│       ├── commonMain/kotlin/    # Shared business logic
│       ├── androidMain/kotlin/   # Android-specific
│       └── iosMain/kotlin/       # iOS-specific
├── androidApp/                   # Android application
└── iosApp/                       # iOS application
```

## KMP Critical Patterns

### Architecture
- Use repository pattern for data access
- Keep platform-specific code minimal (expect/actual pattern)
- **Context**: See `.agent/gatheredContext/platform/native/mobile-development.md`

### Dependency Injection (Koin)
- Define modules in `commonMain` for shared dependencies
- Use platform-specific modules for platform dependencies

### UI (Compose Multiplatform)
- Share UI code in `commonMain` when possible
- Follow Material Design 3 guidelines
- Ensure smooth animations

### Image Handling
- **Android**: Use Coil with quality: 90
- **iOS**: Use native UIImage compression with quality: 0.9
- Always compress to WebP format at 90% quality

### Backend Integration
- Use Convex SDK for backend communication
- Follow same soft delete patterns as web app
- **Context**: See `.agent/gatheredContext/infrastructure/database.md`

## Testing

- Write shared tests in `commonTest`
- Platform-specific tests in `androidTest` and `iosTest`
- Test business logic thoroughly in shared code

## Common KMP Pitfalls (Avoid)

### ❌ Critical Pitfalls
- Putting platform-specific code in `commonMain`
- Not handling network errors gracefully
- Missing authentication checks
- Not respecting soft delete patterns

### ❌ UI Pitfalls
- Ignoring safe areas on iOS
- Blocking main thread with I/O operations

## Context & Knowledge Base

**Quick Reference**: See `.agent/gatheredContext/INDEX.md` for navigation.

**Native-Specific Context**: `.agent/gatheredContext/platform/native/`
- **KMP Implementation**: `mobile-development.md`

**Shared Context**:
- **Authentication**: `features/authentication.md`
- **Database**: `infrastructure/database.md`
- **Storage**: `infrastructure/storage.md`

Also reference `global-guideline.md` for critical patterns.

## Migration from Web

When implementing features from web:
- Reference web implementation for business logic
- Adapt UI to native platform conventions
- Maintain consistency in data models and API contracts
- Don't just copy web UI - follow native patterns

## Native Task Checklist

Before completing a native task:

- [ ] Shared logic verified in `commonTest`
- [ ] Platform-specific logic verified in code
- [ ] Error states handled
- [ ] **Note**: AI does not perform autonomous visual checks (simulators/emulators) unless explicitly requested.