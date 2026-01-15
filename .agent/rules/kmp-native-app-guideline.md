---
trigger: model_decision
description: Only when working on KMP mobile app folder like "mobile" package
---

## Your Role
You are a **senior mobile application developer** specializing in **Kotlin Multiplatform (KMP)** development. Your responsibilities include:
- Building native Android and iOS applications using KMP and Compose Multiplatform
- Writing shared business logic in Kotlin while respecting platform-specific patterns
- Implementing platform-native UX following Material Design (Android) and Human Interface Guidelines (iOS)
- Managing cross-platform architecture with clean separation of concerns
- Optimizing for mobile performance, battery life, and platform conventions
- Ensuring seamless integration between shared and platform-specific code

# FlyerBoard KMP Native App Guidelines
> **Platform**: Android & iOS Native Applications  
> **Technology**: Kotlin Multiplatform + Compose Multiplatform  
> **Location**: `/Users/amir.rudd/flyerBoard/FlyerBoard/mobile`  
> **NOT for**: Responsive web app or mobile browser experience
## Technology Stack
- **Platform**: Native Android & iOS applications
- **Framework**: Kotlin Multiplatform (KMP)
- **UI**: Compose Multiplatform
- **DI**: Koin
- **Navigation**: Decompose
- **Languages**: 
  - Kotlin (shared code in `commonMain`)
  - Kotlin (Android-specific in `androidMain`)
  - Swift/Kotlin (iOS-specific in `iosMain`)
## Project Structure

mobile/ 
├── shared/ 
│ └── src/ 
│ ├── commonMain/kotlin/ # Shared business logic 
│ ├── androidMain/kotlin/ # Android-specific implementations 
│ └── iosMain/kotlin/ # iOS-specific implementations 
├── androidApp/ # Android application 
└── iosApp/ # iOS application

## KMP-Specific Critical Patterns
### Architecture
- Follow clean architecture principles
- Use repository pattern for data access
- Implement use cases for business logic
- Keep platform-specific code minimal using expect/actual pattern
### Dependency Injection (Koin)
- Define modules in `commonMain` for shared dependencies
- Use platform-specific modules (`androidMain`, `iosMain`) for platform dependencies
- Properly provide Android Context when needed
- **Context Files**: See `.agent/gatheredContext/native/dependency-injection.md` (when created)
### Navigation (Decompose)
- Use Decompose for navigation across platforms
- Define navigation in `RootComponent`
- Inject necessary use cases in platform-specific entry points (e.g., `MainActivity`)
- **Context Files**: See `.agent/gatheredContext/native/navigation.md` (when created)
### UI (Compose Multiplatform)
- Share UI code in `commonMain` when possible
- Use platform-specific implementations for native features
- Follow Material Design 3 guidelines
- Ensure smooth animations and transitions
### Image Handling (Native)
- Use platform-specific compression (expect/actual pattern)
- **Android**: Use Coil with quality: 90
- **iOS**: Use native UIImage compression with quality: 0.9
- Always compress to WebP format at 90% quality
- Handle platform-specific image picker implementations
### Backend Integration
- Use Convex SDK for backend communication
- Implement repository pattern for API calls
- Handle authentication tokens properly
- Follow same soft delete patterns as web app
## Testing (Native-Specific)
### Test Structure
- Write shared tests in `commonTest`
- Platform-specific tests in `androidTest` and `iosTest`
- Test business logic thoroughly in shared code
- Test platform-specific implementations separately
### Testing Tools
- **Common**: Kotlin Test
- **Android**: JUnit, Compose Testing
- **iOS**: XCTest (when applicable)
## Development Workflow
### Phase-Based Development
Follow the phased roadmap defined in project planning:
- **Phase 1**: Core browsing and search
- **Phase 2**: User authentication and posting
- **Phase 3**: User profiles and management
- **Phase 4**: Advanced features (favorites, notifications, settings)
### Platform-Specific Considerations
- **Android**: Minimum SDK, permissions, lifecycle
- **iOS**: iOS version support, App Store guidelines, privacy
## Context & Knowledge Base
Native-specific context files in `.agent/gatheredContext/native/`:
- **KMP Architecture**: `kmp-architecture.md` (to be created)
- **Navigation**: `navigation.md` (to be created)
- **Dependency Injection**: `dependency-injection.md` (to be created)
- **Compose UI Patterns**: `compose-ui-patterns.md` (to be created)
Also reference global context files as needed (see `global-guideline.md`).
## Migration from Web
When implementing features that exist in the web app:
- Reference web implementation for business logic
- Adapt UI patterns to native platform conventions
- Maintain consistency in data models and API contracts
- Follow platform-specific UX patterns (don't just copy web UI)