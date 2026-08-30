#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN"
  exit 1
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "Missing GEMINI_API_KEY"
  exit 1
fi

export CLOUDFLARE_API_TOKEN

npx --yes wrangler@3 deploy api/gemini-tech-worker.js --name vin-gemini
printf '%s' "$GEMINI_API_KEY" | npx --yes wrangler@3 secret put GEMINI_API_KEY --name vin-gemini

echo ""
echo "Deployed. Worker URL:"
npx --yes wrangler@3 deployments list --name vin-gemini 2>/dev/null | head -5 || true
