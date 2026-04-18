#!/usr/bin/env bash
set -e

# Publishes @createrington/api-types to the Gitea npm registry.
#
# Does NOT bump the version — the version lives in packages/api-types/package.json
# and is bumped elsewhere (e.g. in the dev → main release PR by the changelog
# automation). This script just builds and publishes whatever version is
# currently checked in.
#
# Usage: pnpm release:api-types                             (from repo root)
#        pnpm --filter @createrington/api-types release     (equivalent)
#        bash packages/api-types/publish.sh                 (direct)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"
VERSION=$(node -p "require('./package.json').version")

cd "$REPO_ROOT"

echo "Building @createrington/server types (api-types depends on them)..."
pnpm --filter @createrington/server build

echo "Building @createrington/api-types..."
pnpm --filter @createrington/api-types build

echo "Publishing v$VERSION to Gitea npm registry..."
pnpm --filter @createrington/api-types publish --no-git-checks

echo ""
echo "Published @createrington/api-types@$VERSION"
