#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<13))throw new Error("Use Node.js 22.13 ou superior")'
export npm_config_cache=/workspace/.npm-cache
export ELECTRON_CACHE=/workspace/tools/electron-cache
mkdir -p "$npm_config_cache" "$ELECTRON_CACHE"
npm ci --no-audit --no-fund
npm run build
npm test
