# Design: v1 dashboard

Status: approved by the owner (2026-11-17). Ready for the tech lead to build. F0 sleep screen approved too (2026-11-17). Open device checks (do not block the build): Wi-Fi reconnect time after a tap, AC writes, ghosting count and clock interval (F3), frontlight staying off (F15). Canvas: https://claude.ai/artifact/Hmn9WmMWRz4nWB2CgVM9wH

## Product

A desk dashboard. The owner looks at it many times a day for a few seconds. It must answer, in one glance: what time is it, what is next today, is it hot inside or outside. It also lets the owner switch home devices after a power-button wake.

It is not a reader. Book features are out of scope.

## Inputs from the owner (2026-11-17)

- Placement: on the desk, glance often.
- Content: clock and date, Google Calendar agenda, weather (Ho Chi Minh City), room temperatures, home control.
- Home system: Homebridge.

## Features and status

"Verified" means the tech lead confirmed it on the device or in KOReader code. "Research-verified" means confirmed from docs and sources, not yet run on the device (see docs/research/07-data-sources.md). Do not build a "needs verification" feature before it is verified.

| # | Feature | Spec | Status |
|---|---|---|---|
| F1 | Full-screen dashboard widget | screens.md | Verified (issue 05) |
| F2 | Swipe between 3 screens (Home, Agenda, Nhà) | interaction.md | Verified: swipe gesture (issue 05). Screen paging itself is plain code. |
| F0 | Sleep screen: Home without clock or touch, refresh every 20–30 min | screens.md | Design approved. Runtime (sleep screen + launcher) being confirmed by the tech lead with the owner. Timing from research 08/09 |
| F3 | Clock, partial refresh of clock box (awake only) | refresh.md | Verified: region refresh API (`setDirty` with region, "ui" mode). Needs verification: ghosting count on device; 1 min vs 5/10 min interval (issue 06 spike) |
| F4 | Date line with lunar date (âm lịch) | screens.md | Research-verified: Ho Ngoc Duc algorithm (UTC+7) in Lua, no network |
| F5 | Weather now + today | screens.md | Research-verified: Open-Meteo over plain HTTP, no key. Credit "Open-Meteo" on screen (CC BY 4.0) |
| F6 | Next 6 hours on Home: temperature + rain chance | screens.md | Research-verified: Open-Meteo hourly |
| F16 | Room temperature, humidity and feels-like per room (Home AC tile, Nhà card) | screens.md | Research-verified: Home Assistant REST API `/api/states`, sensor-to-room mapping from HA areas. Card works without a sensor. Never use the IR AC `CurrentTemperature` (it equals the setpoint) |
| F7 | Today agenda + next event | screens.md | Research-verified via LAN proxy on the Homebridge box (iCal to flat JSON, 7 days) |
| F8 | 3-day agenda screen | screens.md | Research-verified: same source as F7 |
| F9 | Home control: per room AC power + setpoint; bedroom lamp and fan preset toggles | interaction.md | Lamp: research-verified (Homebridge UI API). Fan: verified read and write (HAP). AC: verified API through Home Assistant, writes not run yet. Needs measurement: Wi-Fi reconnect time after a tap with Wi-Fi off, tap-to-result time with Wi-Fi off |
| F10 | Status line (sync time, Wi-Fi, battery) | states.md | Verified: `powerd:getCapacity()`, `isCharging()` |
| F11 | Stale, offline and error states | states.md | Plain code, after F5–F9 |
| F12 | Night window, no wakes | refresh.md | Verified as a concept in issue 06 spike; length is a setting |
| F13 | Vietnamese font (Be Vietnam Pro) | visual.md | Verified: `Font:getFace(path, size)` loads a TTF from the plugin folder; bundled Noto Sans covers Vietnamese. One render test on device left. |
| F14 | Page-turn buttons change screen (awake only) | interaction.md | Verified: `RPgFwd` / `RPgBack` key events. They do not wake the device. |
| F15 | Frontlight off while the dashboard runs | interaction.md | Verified API (`setIntensity(0)`). Needs verification: auto brightness turns it back on; state after sleep |

Open: cover sensor wake while KOReader runs, time from button wake to first tap (expect about 1 s). They do not block v1.

## Architecture

Decided in ADR 0002 (server-rendered dashboard): a LAN server renders the canvas HTML templates to 1264x1680 grayscale PNGs; the Kindle shows them (sleep screen daemon; KOReader viewer with tap regions). Priority for v1: the sleep screen (F0).

## Data sources (from tech lead)

The Kindle talks only plain HTTP on the LAN: Home Assistant REST API (rooms: AC climate entities and sensors, long-lived token), the Homebridge UI API (bedroom lamp), and one small proxy (calendar, and weather if direct HTTP stops). Data refresh follows the Wi-Fi sync rule (20 min).

## Files

- `screens.md`: the 3 screens, zones and content.
- `interaction.md`: gestures, wake, home control flow.
- `refresh.md`: what redraws when, and how that maps to the wake rules.
- `states.md`: tile states, status line, fallbacks.
- `visual.md`: type, gray levels, sizes.
- `layout-grid.md`: fixed zone and slot rectangles (no layout drift).
- `overflow.md`: long text and too many items, per screen.
