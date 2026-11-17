# Refresh and battery

Every redraw costs battery and every full refresh flashes. The design is built so most wakes change only the clock box.

## Zones (see canvas, "Refresh map")

| Zone | Redraw when | Refresh type | Wi-Fi |
|---|---|---|---|
| B Clock | Each clock wake (1 min now; may become 5 min, see below) | Partial, clock box only | No |
| B Date line | At 00:00 | Full, with the daily full refresh | No |
| A Status | With each sync, or a state change (Wi-Fi, low battery, charging) | Partial | No |
| C Weather + rooms | After a sync, only if a shown value changed | Full | Sync |
| D Agenda | After a sync if events changed; on calendar wake (10 min) if the "N phút nữa" step or the next event changed | Full on sync change, partial on label change | Sync only |
| E Tiles | After a tap; after a sync if a state changed | Partial, that tile only | Tap: yes |

Mapping to the spike wake rules (issue 06): clock = 1 min, calendar = 10 min, wifi = 20 min.

## Rules for the developer

- Compare the new frame with the last drawn frame per zone. Skip zones that did not change (re-kindle does this for the whole screen).
- "N phút nữa" uses steps: 60, 45, 30, 15, 10, 5, "sắp bắt đầu", "đang diễn ra". It changes the screen at most at those steps, not each minute. Show steps as "còn 1 giờ" above 60.
- Room temperature rounds to 0,5° so sensor noise does not redraw zone C.
- Refresh modes (KOReader `UIManager:setDirty(widget, mode, region)`, verified): clock and tiles use "ui" (no flash, does not count toward KOReader's FULL_REFRESH_COUNT of 6). Zone changes after a sync use "full" on that region only when needed.
- Full refresh: at 00:00, after a sync that changed C or D, and at most once per sync (20 min) or hourly for ghost clean-up. The ghost count on the Oasis panel needs verification; tech lead tunes it on the device.
- Clock box (zone B) has no black fills and no inverted blocks. Only black digits on white change. Partials ghost most on large black-to-white changes (tech lead).
- Never full refresh for the clock alone.
- Wait for the refresh to finish before sleep (research 01).

## Sleep screen timing (tech lead, 2026-11-17)

- Every wake through powerd keeps the device awake at least 60 s (fixed powerd timer). The direct-suspend path failed on this model and firmware in the only report (research 08).
- So the sleep screen refreshes every 20–30 min (tunable), with one full refresh per wake. No live minute clock while asleep: the sleep screen shows no clock (screens.md, section 0).
- While the device is awake and the interactive dashboard is open, the clock ticks every minute ("ui" partial refresh) as designed.

## Night window

01:00 to 06:00 by default (setting). No clock wakes, no syncs. Before sleeping at 01:00, draw status "Nghỉ đêm · bấm nút nguồn để xem" on the sleep screen and keep the last frame. First sync and full refresh at 06:00.

## Clock interval decision (needs verification)

A 1-minute clock wake may cost more battery than everything else together (spike question). Options, to decide after the spike log:

1. 1 min clock (best glance value).
2. 5 min clock, show "10:25" rounded down, no seconds. Owner still sees roughly the time.
3. 1 min during work hours (08:00–19:00 setting), 5 min otherwise.

Design works with all three; the clock zone does not change. Default proposal: option 3 if 1 min misses the battery target.

Tech lead (2026-11-17): the powerd wake path lands 5–25 s late and keeps the device awake long. A direct-suspend path that redraws at :00 is in test. So the design supports two clock modes:

- **Exact mode** (1 min wake at :00): clock shows HH:MM. No extra label.
- **Coarse mode** (5 or 10 min wake): clock shows the time of the wake, rounded down to the interval ("10:25", never "10:27"). No "updated" label next to the clock: the status line already has the sync time, and an extra label adds noise. The clock redraws to the exact minute on every power-button wake and every tap, so it is exact whenever the owner uses the device.
- In coarse mode, the "N phút nữa" label must not lie: compute it from the wake time and round the minutes down to a step (so "5 phút nữa" can only be early, never late).
- Mode is a setting; the tech lead picks the default after the spike.

## Battery target

Prior art: about 10% per week with hourly wakes (re-kindle). Our wakes are much more frequent, so the target needs a new number after the spike. Needs verification.
