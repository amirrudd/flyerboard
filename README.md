# FlyerBoard

A modern classified marketplace web application built with Convex, React, and Cloudflare R2.

## Overview

FlyerBoard is a classified ads platform (flyers = ads) with advanced features:
- **Descope Authentication**: Secure auth with OTP support
- **Cloudflare R2 Storage**: Efficient image storage and delivery
- **Adaptive Image Compression**: Network-aware compression for optimal upload times
- **Real-time Messaging**: Built-in chat between buyers and sellers
- **Location-based Search**: Nominatim API integration
- **Responsive Design**: Mobile-first UI with smooth interactions

This project is connected to the Convex deployment named [`doting-dogfish-130`](https://dashboard.convex.dev/d/doting-dogfish-130).

## Project Structure

```
├── src/
│   ├── components/ui/      # Reusable UI components
│   ├── features/           # Feature-specific components
│   │   ├── ads/           # Ad listing and creation
│   │   ├── auth/          # Authentication
│   │   ├── dashboard/     # User dashboard
│   │   └── layout/        # Layout components
│   └── lib/               # Utilities and helpers
├── convex/                # Backend functions and schema
├── docs/                  # Project documentation
└── public/               # Static assets
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Add your Descope and Cloudflare R2 credentials
   - See [docs/descope-convex-integration.md](docs/descope-convex-integration.md) for details

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Key Features

### Image Upload & Compression
- **Adaptive compression** based on network speed (see [src/lib/networkSpeed.ts](src/lib/networkSpeed.ts))
- **Non-blocking UX**: Images appear instantly, compression runs in background
- **Consistent quality**: Always 90% quality regardless of uploader's connection
- **Circular progress indicators** for smooth user experience

### Authentication
- Descope integration with OTP support
- Privacy-focused (no phone number storage)
- See [docs/descope-convex-integration.md](docs/descope-convex-integration.md)

### Storage
- Cloudflare R2 for image storage
- Direct uploads with presigned URLs
- See [docs/storage-migration.md](docs/storage-migration.md) and [docs/r2-cors-setup.md](docs/r2-cors-setup.md)

## Documentation

- [Authentication Architecture](docs/authentication-architecture.md)
- [Descope-Convex Integration](docs/descope-convex-integration.md)
- [Storage Migration](docs/storage-migration.md)
- [R2 CORS Setup](docs/r2-cors-setup.md)

## Development Guidelines

See [.agent/rules/user-instructed-guideline.md](.agent/rules/user-instructed-guideline.md) for:
- Architecture patterns
- Naming conventions
- Testing requirements
- Code style guidelines

## Deployment

Check out the [Convex Hosting and Deployment](https://docs.convex.dev/production/) docs for deployment instructions.

**Environment Variables:**
- Convex: Set in Convex dashboard (R2 credentials, Descope keys)
- Vercel: Only needs `VITE_CONVEX_URL` and `VITE_DESCOPE_PROJECT_ID`

