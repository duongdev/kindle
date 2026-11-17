# 2. Server-rendered dashboard on the stock home

Date: 2026-11-17. Status: accepted.

## Context

The owner uses the stock Kindle home most of the time and wants the dashboard without keeping KOReader open. The v1 design is approved (`docs/design/`). Research:

- A sleep-screen daemon can run beside the stock UI. It turns off the stock screensaver at run time and draws over it. See `docs/research/09-stock-home-dashboard.md`.
- Every RTC wake through powerd keeps the device awake at least 60 s. Direct suspend failed on this model and firmware in the only report. So the sleep screen refreshes every 20-30 min, not every minute. See `docs/research/08-direct-suspend.md` and issue 06.
- Home data comes from Home Assistant, Homebridge and the fan bridge on the LAN. The calendar needs a LAN proxy anyway. See `docs/research/07-data-sources.md`.

## Decision

- A LAN server (the dashboard server) fetches all data and renders each screen from the approved HTML design to a 1264x1680 grayscale PNG. It also runs the actions (AC, lamp, fan).
- The Kindle is a thin client:
  - Sleep screen: a small daemon. On each powerd sleep or RTC wake it downloads the PNG and draws it with FBInk.
  - Interactive: a KOReader plugin, opened from a stock-home launcher. It shows the PNG and maps tap regions to server actions, then shows the new PNG.
- The server returns the tap regions with each screen, so the Kindle code does not know the layout.

## Consequences

- One renderer. The screen matches the design canvas exactly.
- The Kindle code is small: fetch, draw, map taps, sleep.
- The dashboard needs the server. If the server is down, the Kindle keeps the last image and shows its age.
- The minute clock exists only while the interactive dashboard is open.
- The boot autostart uses SpiderCat's `emergency.sh` hook. It needs its own procedure and a manual test first (risk R26).
