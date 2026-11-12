#!/usr/bin/env bash
set -e

echo "=== Money+ Fast Upload & Build Script ==="

# 1. Run engine verification unit tests
echo "--> Running unit tests..."
node scripts/verify_engine.js

# 2. Upload to EAS and return immediately with the build link (no waiting in queue)
echo "--> Uploading project to EAS servers..."
EAS_NO_VCS=1 npx --yes eas-cli build --platform android --profile preview --no-wait "$@"

echo ""
echo "✅ Project uploaded successfully to EAS servers!"
echo "Check build progress or download the APK anytime with: npm run build:status"
