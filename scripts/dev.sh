#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

cleanup() {
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "Starting backend..."
cd "$ROOT_DIR/backend"
npx tsx watch src/index.ts &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
npm run dev
