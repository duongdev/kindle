# KOReader emulator spike

Status: resolved

Run the KOReader desktop emulator on macOS. Build a hello-world plugin with a full-screen widget, one tap zone, and one swipe gesture. Not blocked by the device.

## Progress

2026-11-16: emulator runs (macOS arm64 nightly, `scripts/emu.sh`, docs/procedures/emulator.md). `plugins/dashboard.koplugin` shows a full-screen text screen (time, date, tap counter). Tap verified (counter goes up). Swipe-to-close verified by hand (real mouse drag).

2026-11-16: deployed to the Kindle with `scripts/deploy.sh` (Wi-Fi SSH). Opened from Tools > More tools > Dashboard; works on the device.
