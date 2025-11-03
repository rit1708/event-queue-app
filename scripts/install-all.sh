#!/usr/bin/env bash
set -euo pipefail

# Install all dependencies for the monorepo and workspaces
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "[install-all] Installing root dependencies (workspaces included)" 
npm install

# Optional: build shared packages first (e.g., SDK)
echo "[install-all] Building SDK package"
npm -w packages/sdk run build || true

echo "[install-all] Done"
