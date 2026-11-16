# KOReader as the app platform

Researched 2026-11-16. Not yet tested on this device.

- The name has no official expansion. The project started as kindlepdfviewer and was renamed when it was ported to Kobo.
- Runs on Kindle, Kobo, PocketBook, reMarkable, Android, and desktop Linux and macOS (emulator).

## Extension points

- **Plugin**: `plugins/<name>.koplugin/` with `_meta.lua` and `main.lua`. Adds menu items and can open a full-screen widget.
- **Dispatcher actions**: a plugin registers actions that the user can bind to gestures (swipe, corner tap, multi-finger).
- **"Start with" setting**: picks the first view at startup. A plugin can also show its own widget at startup, so a custom launcher can act as the home screen.
- **User patches**: `koreader/patches/*.lua` run at startup and can monkeypatch any module without a fork.
- Reference for a full UI replacement: the third-party "Project: Title" plugin.

## Open questions

- How a KOReader plugin schedules an RTC wake from suspend, and how reliable it is on KOA3.
- Whether KOReader can turn Wi-Fi off and on around a fetch on this device.
- How to start KOReader from the Kindle home screen on 5.18 (KUAL, or a library item).
