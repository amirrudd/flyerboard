# Mobile Development (KMP) Context

## Overview

FlyerBoard mobile applications are being developed using **Kotlin Multiplatform (KMP)** with **Compose Multiplatform** for UI. The mobile codebase resides in the `mobile/` directory and is completely isolated from the web application.

> [!IMPORTANT]
> **No changes to web app code** during mobile development. Mobile code is in `mobile/` only.

## Technology Stack

| Component | Library |
|-----------|---------|
| Networking | Ktor Client |
| Serialization | Kotlinx.serialization |
| DI | Koin |
| Image Loading | Coil 3.0 |
| Database | SQLDelight |
| Navigation & State | Decompose |
| Auth | Descope SDK |
| Testing | Kotest (BDD) |

## Architecture

- **Clean Architecture**: Data → Domain → Presentation layers
- **State Management**: Decompose component-based architecture
- **Testing**: TDD with BDD (Given-When-Then scenarios)

## Backend Integration

**Decision**: REST API layer via Convex HTTP actions (`convex/http.ts`)

Mobile endpoints pattern:
```
/api/mobile/flyers      - CRUD operations
/api/mobile/categories  - Category tree
/api/mobile/chats       - Messaging
/api/mobile/users       - User profile
/api/mobile/upload      - Presigned upload URLs
```

**Rationale**: Future-proof for potential backend migrations - only API layer needs updating.

## Key Decisions

1. **Backend**: REST API (not Convex SDK) for migration flexibility
2. **Navigation**: Decompose (unified navigation + state)
3. **Auth**: Descope SDK (automatic secure token storage)
4. **Testing**: TDD/BDD with Kotest
5. **Admin Features**: Excluded from mobile scope

## WebView Pages

Static content loaded via WebView:
- Terms & Conditions
- Community Guidelines
- About Us
- Support/FAQ

## Project Structure

```
mobile/
├── shared/                 # KMP shared module
│   └── src/
│       ├── commonMain/     # Shared code (domain, data, DI)
│       ├── androidMain/    # Android-specific
│       └── iosMain/        # iOS-specific
├── androidApp/             # Android application
└── iosApp/                 # iOS application
```

## Implementation Status

### ✅ Phase 0: Project Setup
- Complete KMP project structure
- Gradle configuration with all dependencies
- Material 3 theme matching web app
- Domain models (Flyer, Category, User, Message, Chat)
- Koin DI setup

### ✅ Phase 1: Authentication
- BDD test scenarios (Kotest)
- AuthRepository interface
- Use cases: LoginUseCase, VerifyOtpUseCase, LogoutUseCase
- Descope SDK integration (Android)
- Decompose navigation (RootComponent)
- Auth UI screens (Phone login, OTP verification)
- iOS stub (to be implemented later)

**Configuration**: Requires Descope project ID in `mobile/local.properties`

### ⏳ Phase 2: Core Flyer Features (Next)
- REST API endpoints in convex/http.ts
- Flyer repository with Ktor
- Home screen with flyer grid
- Flyer detail screen
- Post flyer screen
- Image upload with compression

## Related Documents

- [Full Implementation Plan](../docs/mobile-kmp-implementation-plan.md)
- [Database Schema](./database.md)
- [Authentication](./authentication.md)
- [Push Notifications](./push-notifications.md)

## Timeline

**12 weeks** to App Store submission:
- Phase 0-1: Setup + Auth (3 weeks) ✅ **COMPLETE**
- Phase 2-3: Flyers + Messaging (5 weeks) ⏳ **NEXT**
- Phase 4-6: Dashboard + WebViews + Notifications (3 weeks)
- Phase 7: Polish (1 week)

## Testing

Test phone number: `0466666666`

Run tests:
```bash
cd mobile
./gradlew :shared:test
```

## Setup Instructions

See [mobile/README.md](file:///Users/amir.rudd/flyerBoard/FlyerBoard/mobile/README.md) for detailed setup instructions.
