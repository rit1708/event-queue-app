#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

MODE="${1:-docker}" # docker | local

if [[ "$MODE" == "docker" ]]; then
  echo "[run-all] Starting via Docker Compose..."
  docker compose up --build
elif [[ "$MODE" == "local" ]]; then
  echo "[run-all] Starting locally (requires MongoDB & Redis running)"
  npm run dev:local
else
  echo "Usage: scripts/run-all.sh [docker|local]" >&2
  exit 1
fi
