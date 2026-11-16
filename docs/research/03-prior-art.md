# Prior art

Researched 2026-11-16 by reading the source code.

## re-kindle

https://github.com/abdenourgnx/re-kindle

A weather and prayer-times dashboard for a Kindle 7th gen (KT2, firmware 5.12.2.2, 600×800). It is a KUAL extension written in POSIX shell and busybox awk, and it draws with FBInk. The author reports about 10% battery drain per week.

### Battery loop (`extensions/dashboard/loop.sh`)

1. Wi-Fi on (`lipc-set-prop com.lab126.cmd wirelessEnable 1`). Retry the fetch every 5 s until it works, or stop after `WIFI_WAIT` = 60 s.
2. Wi-Fi off right after the fetch.
3. Render, then compare the draw commands with the last drawn screen (ignoring the "Updated" line). **Skip the e-ink refresh when nothing changed.**
4. Full refresh, then wait for it to finish (`fbink -f -s -w`). A suspend during a refresh leaves a half-drawn screen.
5. Suspend: write `+seconds` to `/sys/class/rtc/rtc*/wakealarm`, `sync`, then `echo mem > /sys/power/state`.
6. Next wake = now + `INTERVAL` (3600 s). If that falls inside `NIGHT` (01–07 local), wake at the end of the night window instead.
7. If the device wakes well before the alarm, the power button woke it. Stay awake for `IDLE` = 20 s for taps, then sleep again.
8. After 3 failed suspends in a row, stop trying and stay awake (Wi-Fi still goes off).

Other battery savers: extra wakes without Wi-Fi only when the screen must change (the next prayer time), and `preventScreenSaver 1` so powerd does not suspend on its own timer while the loop is awake.

### Touch

- A background reader parses raw evdev from `/dev/input/event1` with `dd bs=16 | od -t d2` (16-byte events on 32-bit). `EV_ABS` codes 53/54 (MT X/Y) or 0/1, and `SYN_REPORT` ends a touch.
- The touch reader never draws. It writes a request (`today`, `10d`, `card`) to a file, and the main loop does `mv tap tap.read`. One process owns the screen.
- Debounce: one card toggle per 2 s, because one tap sends several reports.
- The Kindle UI is paused with `killall -STOP cvm`. Tapping the top-left place name runs `stop.sh`, which resumes `cvm`, turns Wi-Fi on, clears the RTC alarms, and opens the Kindle home screen.

### Dev workflow

- Render code (`render.awk`) emits a line protocol (`T|style|px|left|right|top|flags|text`, `R|x|y|w|h|color`, `I|name|x|y`), and the device loop runs it through FBInk.
- The same protocol becomes SVG on the Mac (`tools/preview.py`), then a headless Chrome screenshot at 600×800. Layout can be tested without the device.
- `check.sh` checks render output, the scheduling functions, and on-screen bounds against fixtures. Run it with `sh`, not zsh, to match the device shell.
- Deploy over USB mass storage: copy to a temp name, then rename (a new inode, so a running script is not corrupted), `cmp`, and delete macOS `._*` files.
- `probe.sh` records device capabilities (tools, curl HTTP vs HTTPS, fonts, input devices) and 12 s of raw touch events. Run a probe like this first on our device.
- Autostart: an upstart job in `/etc/upstart` (`start on started framework`) that waits 90 s, so there is time to recover if the dashboard is broken. A flag file turns it on or off.

### Gotchas the author hit

- Busybox awk parses `name (expr)` as a function call.
- The device clock is UTC. Local time comes from the API's UTC offset.
- The old TLS stack: Open-Meteo is fetched over plain HTTP on purpose.
- FBInk 1.25 cannot draw images, so icons use `eips -g`.

## kdashboard

https://github.com/thecodedose/kdashboard

A planner dashboard (tasks, health stats, meals) with tap-to-complete. The device side is native C++ (`kindle/native/src/kindle_dashboard.cpp`, about 3,300 lines). The backend is InsForge edge functions in TypeScript with Postgres. Input also comes from a Telegram bot with an optional OpenAI parser.

Ideas to reuse:

- **Version hash + SSE**: the server sends only a small version string over SSE. The device fetches the full JSON only when the version changes. (This needs Wi-Fi to stay on, so it fits a powered device better than ours.)
- **Offline-first cache**: render from a cached JSON file and label the screen "offline" when the fetch fails.
- **Optimistic toggle**: update the local cache and redraw at once, then post the change to the server.
- **Touch**: scans `/dev/input/event*`, reads the axis ranges with `EVIOCGABS`, and takes exclusive input with `EVIOCGRAB` so the Kindle UI does not see the taps. Tap regions are plain rectangles mapped to actions.
- **Drawing**: renders into a canvas, then writes `/dev/fb0` through `mmap`.
- Its launcher keeps the device awake by default (`DASHBOARD_KEEP_AWAKE=1`), so it is not a model for battery use.

## What this means for us

- re-kindle's loop is the battery baseline to beat: hourly wake, Wi-Fi only during the fetch, a night window, skip refreshes that change nothing, and power-button wake for a short interactive window.
- With KOReader we must check that the same steps are possible from a plugin (RTC wake, Wi-Fi toggle, suspend). If they are not, a small shell loop like re-kindle's can own the schedule and start KOReader only for interactive sessions.
- Copy the dev workflow ideas: a device probe script, a desktop preview, fixture-based checks, and safe deploys.
