#!/bin/sh
# Run the dashboard server on the Mac against the real home (no fixtures).
# Reads secrets from private/ha.env and private/homebridge.env; optional CALENDARS in private/calendars.env.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
set -a
. "$ROOT/private/ha.env"
. "$ROOT/private/homebridge.env"
[ -f "$ROOT/private/calendars.env" ] && . "$ROOT/private/calendars.env"
set +a
cd "$ROOT/server"
CONFIG=../private/server-config.json PORT="${PORT:-8099}" exec node_modules/.bin/tsx src/server.ts
