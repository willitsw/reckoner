#!/usr/bin/env sh
# Run Maestro E2E flows. Requires the Maestro CLI and a running app/simulator.
# Only top-level YAMLs are entry flows; e2e/maestro/flows/ are shared runFlow includes.
set -eu

APP_ID="${MAESTRO_APP_ID:-host.exp.Exponent}"
export MAESTRO_APP_ID="$APP_ID"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI not found. Install from https://maestro.mobile.dev/" >&2
  exit 1
fi

echo "Running Maestro flows with appId=$MAESTRO_APP_ID"
maestro test \
  e2e/maestro/smoke.yaml \
  e2e/maestro/archive.yaml \
  e2e/maestro/delete.yaml \
  --env MAESTRO_APP_ID="$MAESTRO_APP_ID"
