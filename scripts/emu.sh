#!/bin/sh
# Run the KOReader desktop emulator with this repo's plugins, isolated from any other KOReader data.
# Usage: sh scripts/emu.sh          # Oasis 3 layout at half size (632x840, 150 dpi)
#        FULL=1 sh scripts/emu.sh   # real Oasis 3 size (1264x1680, 300 dpi)
#        DASHBOARD_AUTOSTART=1 sh scripts/emu.sh   # open the dashboard right after launch
# Setup once: extract the KOReader macOS build to private/emu/app/KOReader.app (see docs/procedures/emulator.md).

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP="$ROOT/private/emu/app/KOReader.app/Contents/MacOS/koreader"
export KO_HOME="$ROOT/private/emu/home"

[ -x "$APP" ] || { echo "KOReader app missing: $APP"; exit 1; }
mkdir -p "$KO_HOME/plugins"
for p in "$ROOT"/plugins/*.koplugin; do ln -sfn "$p" "$KO_HOME/plugins/$(basename "$p")"; done

if [ "${FULL:-0}" = 1 ]; then W=1264 H=1680 DPI=300; else W=632 H=840 DPI=150; fi
EMULATE_READER_W=$W EMULATE_READER_H=$H EMULATE_READER_DPI=$DPI exec "$APP" "$@"
