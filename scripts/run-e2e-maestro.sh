#!/usr/bin/env sh
# Run Maestro smoke flows. Requires the Maestro CLI and a running app/simulator.
set -eu

APP_ID="${MAESTRO_APP_ID:-host.exp.Exponent}"
export MAESTRO_APP_ID="$APP_ID"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI not found. Install from https://maestro.mobile.dev/" >&2
  exit 1
fi

echo "Running Maestro smoke with appId=$MAESTRO_APP_ID"
maestro test e2e/maestro/smoke.yaml --env MAESTRO_APP_ID="$MAESTRO_APP_ID"
