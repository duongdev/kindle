# Procedure: KOReader emulator on macOS

Status: working since 2026-11-16.

## One-time setup (done)

- Official release v2026.07.1 has no macOS build. The nightly does: `koreader-macos-11.0-arm64-v2026.07.2-329-gf941b73_2026-11-15.7z` from `https://build.koreader.rocks/download/nightly/2026.07.2-329-gf941b73/` (SHA-256 checked against the `.sha256` file).
- Extracted with `tar -xf` to `private/emu/app/KOReader.app` (gitignored).
- Version drift: the device runs v2026.07.1. Re-test on the device before relying on newer APIs.

## Run

```sh
sh scripts/emu.sh                          # Oasis 3 layout at half size (632x840, 150 dpi)
FULL=1 sh scripts/emu.sh                   # real size (1264x1680, 300 dpi)
DASHBOARD_AUTOSTART=1 sh scripts/emu.sh    # open the dashboard right after launch
```

- `KO_HOME=private/emu/home` keeps emulator settings apart from any other KOReader data.
- The script symlinks every `plugins/*.koplugin` into `private/emu/home/plugins/`, so edits in the repo apply on the next emulator start.
- In KOReader without autostart: top menu > Tools > More tools > Dashboard.
- Mouse click = tap. Mouse drag = swipe.

## Notes

- `_meta.lua` must not have a `name` field (deprecated, logs a warning).
- Syntax check without running: `private/emu/app/KOReader.app/Contents/koreader/luajit -e "assert(loadfile('plugins/dashboard.koplugin/main.lua'))"`.
- Claude's background computer-use clicks work as taps, but its drags arrive as taps, so swipes need a real mouse drag.
