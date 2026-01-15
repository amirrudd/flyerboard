# FlyerBoard Documentation

**For Developers** - Human-readable documentation

---

## Quick Start

- **New to the project?** Start with this README
- **Setting up?** See `guides/` for setup instructions
- **Understanding architecture?** See `architecture/` for design decisions
- **Migrating?** See `migrations/` for migration guides

---

## Documentation Structure

```
docs/
├── README.md                    # This file - project overview
├── architecture/                # Architecture & design decisions
│   ├── authentication-architecture.md
│   ├── architecture-review.md
│   └── design-decisions.md
├── guides/                      # Setup & usage guides
│   ├── push-notifications.md
│   └── r2-cors-setup.md
└── migrations/                  # Historical migration guides
    ├── descope-convex-integration.md
    ├── email-notifications-update.md
    └── storage-migration.md
```

---

## Project Overview

**FlyerBoard** is a classified marketplace application where users can post, browse, and manage classified ads (called "flyers").

### Platforms
- **Web Application**: React-based responsive web app
- **Native Mobile Apps**: Kotlin Multiplatform (KMP) apps for Android and iOS

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Convex (BaaS with real-time capabilities)
- **Authentication**: Descope (OTP-based)
- **Storage**: Cloudflare R2
- **Notifications**: Resend (email) + Web Push API
- **Deployment**: Vercel (frontend) + Convex (backend)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Web App (Vite)                                       │
│  - Mobile Apps (KMP)                                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─── Descope (Authentication)
                 │
                 ├─── Convex (Backend + Database)
                 │
                 ├─── Cloudflare R2 (Image Storage)
                 │
                 └─── Resend (Email Notifications)
```

### Key Features
- **Real-time updates** via Convex reactive queries
- **Adaptive image compression** based on network speed
- **PWA support** with offline capabilities
- **Push notifications** for new messages
- **Email notifications** with spam prevention
- **Admin dashboard** for content moderation
- **Mobile-first responsive design**

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Convex account
- Descope account
- Cloudflare account (for R2)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FlyerBoard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env.local`:
   ```bash
   # Convex
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   
   # Descope
   VITE_DESCOPE_PROJECT_ID=your_descope_project_id
   
   # Optional: Push Notifications
   ENABLE_PUSH_NOTIFICATIONS=true
   VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Start Convex backend
   npx convex dev
   
   # Terminal 2: Start frontend
   npm run dev
   ```

5. **Access the app**
   - Web: http://localhost:5173
   - Convex Dashboard: https://dashboard.convex.dev

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## Architecture Documentation

### Authentication
See [`architecture/authentication-architecture.md`](architecture/authentication-architecture.md)

**Key Points:**
- Hybrid architecture: Descope (identity) + Convex (authorization)
- JWT token flow with OIDC verification
- Row-level security (RLS) in all mutations
- Session persistence and auto-refresh

### Design Decisions
See [`architecture/design-decisions.md`](architecture/design-decisions.md)

**Key Decisions:**
- Why Convex over traditional backend
- Why Descope for authentication
- Why R2 for storage
- DRY principle enforcement

### Architecture Review
See [`architecture/architecture-review.md`](architecture/architecture-review.md)

**Overall Grade: A- (85/100)**

**Strengths:**
- Modern tech stack (React 19, TypeScript, Vite, Convex)
- Feature-based architecture
- Excellent performance optimization
- Mobile-first responsive design
- Real-time capabilities

**Areas for Improvement:**
- E2E testing
- Content Security Policy (CSP)
- Rate limiting
- Internationalization (i18n)

---

## Setup Guides

### Push Notifications
See [`guides/push-notifications.md`](guides/push-notifications.md)

**Setup:**
1. Generate VAPID keys
2. Configure environment variables
3. Deploy to Vercel

**Platform Support:**
- ✅ Android (browser + PWA)
- ✅ Desktop (all browsers)
- ⚠️ iOS 16.4+ (PWA only, must install to home screen)

### R2 CORS Configuration
See [`guides/r2-cors-setup.md`](guides/r2-cors-setup.md)

**Critical for image uploads!**

Without proper CORS configuration, image uploads will fail with 403 errors.

---

## Migration Guides

### Storage Migration (Convex → R2)
See [`migrations/storage-migration.md`](migrations/storage-migration.md)

**Status:** Completed

Migrated from Convex storage to Cloudflare R2 for:
- Better performance
- Lower costs
- Direct browser uploads
- Organized folder structure

### Descope-Convex Integration
See [`migrations/descope-convex-integration.md`](migrations/descope-convex-integration.md)

**Status:** Completed

Integrated Descope authentication with Convex backend using OIDC.

### Email Notifications
See [`migrations/email-notifications-update.md`](migrations/email-notifications-update.md)

**Status:** Completed

Added email notifications via Resend with:
- HTML/text templates
- Spam prevention
- Time-based batching
- User preferences

---

## Development Guidelines

### For AI Agents
AI agents should refer to `.agent/` directory:
- **Rules**: `.agent/rules/` - Coding standards
- **Context**: `.agent/gatheredContext/` - Implementation details
- **Workflows**: `.agent/workflows/` - Task procedures
- **Skills**: `.agent/skills/` - Specialized capabilities

### For Human Developers
Human developers should refer to `docs/` directory (this folder):
- **Architecture**: High-level design decisions
- **Guides**: Setup and usage instructions
- **Migrations**: Historical migration guides

---

## Contributing

### Code Quality Standards
- Follow existing architecture and naming conventions
- Write tests for new features and bug fixes
- Update documentation when making changes
- Follow DRY principle (Don't Repeat Yourself)
- No redundant code or comments

### Testing Requirements
- Unit tests for new features
- Integration tests for critical flows
- Update existing tests when functionality changes
- Ensure no regressions

### Documentation Requirements
When completing a task:
1. **Code changes** → Update `.agent/gatheredContext/` (AI reference)
2. **Architecture decisions** → Update `docs/architecture/design-decisions.md`
3. **New patterns** → Update `.agent/rules/`
4. **Repeatable procedures** → Create `.agent/workflows/`

---

## Deployment

### Frontend (Vercel)
- Automatic deployment on push to `main`
- Preview deployments for PRs
- Environment variables configured in Vercel dashboard

### Backend (Convex)
- Automatic deployment via `npx convex deploy`
- Environment variables configured in Convex dashboard
- Production URL: https://your-deployment.convex.cloud

### Storage (Cloudflare R2)
- Bucket: `flyer-board-images`
- CORS configured for browser uploads
- Organized folder structure: `profiles/`, `flyers/`

---

## Support & Resources

### External Documentation
- [React Documentation](https://react.dev)
- [Convex Documentation](https://docs.convex.dev)
- [Descope Documentation](https://docs.descope.com)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Vite Documentation](https://vitejs.dev)

### Internal Resources
- **AI Context**: `.agent/gatheredContext/INDEX.md`
- **Global Guidelines**: `.agent/rules/global-guideline.md`
- **Workflows**: `.agent/workflows/`

---

## License

[Add license information here]

---

## Contact

[Add contact information here]
