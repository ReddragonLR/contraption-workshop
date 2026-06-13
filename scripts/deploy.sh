#!/usr/bin/env bash
# Deploy Contraption Workshop to Firebase Hosting (PRD §15).
# Usage: PROJECT_ID=my-project ./scripts/deploy.sh   (defaults to .firebaserc project)
# Set SKIP_CHECKS=1 to skip the pre-deploy test gate (not recommended).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID="${PROJECT_ID:-game-the-incredible-machine}"

if [[ "${SKIP_CHECKS:-0}" != "1" ]]; then
  echo "▶ Pre-deploy gate: unit tests"
  npm test
  echo "▶ Pre-deploy gate: E2E tests"
  npm run test:e2e
fi

echo "▶ Building production bundle"
npm run build

echo "▶ Deploying to Firebase Hosting (project: $PROJECT_ID)"
firebase deploy --only hosting --project "$PROJECT_ID"

echo "✓ Deployed. Live at: https://$PROJECT_ID.web.app"
