#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 22.13 or newer from https://nodejs.org"
  exit 1
fi
echo "Starting VaultPOS..."
echo
exec node --disable-warning=ExperimentalWarning server.js
