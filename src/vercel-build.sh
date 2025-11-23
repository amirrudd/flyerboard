#!/bin/bash

# VERCEL_ENV is a system environment variable provided by Vercel
if [ "$VERCEL_ENV" == "production" ]; then
    # Production Branch (main) - Deploy to Convex and then build frontend
    echo "✅ Running Production Build: Deploying Convex backend."
    npx convex deploy --cmd 'npm run build'
else
    # Preview Branches - DO NOT deploy backend, just run the frontend build
    echo "🚧 Running Preview Build: Skipping Convex deploy."
    npm run build
fi