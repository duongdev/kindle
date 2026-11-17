# Layout grid (no drift)

Every zone and slot has a fixed position and size. Content never moves a zone. Why: a partial refresh redraws a fixed rectangle, so a zone that shifts by even a few pixels leaves ghosts and forces a full refresh. The owner also learns where to look; moving parts break the glance.

## Rules

1. Fixed rectangles. Each zone and each slot inside it has a fixed `x, y, w, h`. Layout is computed once at start, not from content.
2. Fixed row counts. Lists have a fixed number of slots. Missing items leave the slot blank. Extra items become "+N sự kiện" in the last slot.
3. Text never wraps unless the slot says so. One-line slots cut with "…". Two-line slots (next event title, tile label) clamp at 2 lines with "…".
4. Fixed-width columns for numbers. Times, temperatures and percents use tabular digits in a column of fixed width, aligned right (values) or left (times). "9°" and "31°" take the same box.
5. Always 2-digit hours: "08:45", never "8:45". The clock box width never changes.
6. Pending, empty, error and normal states of a section use the same rectangle. A state change never moves anything outside its section.
7. Status line: left and right halves each have a fixed half width; text cuts with "…".

## Home (1264 x 1680, margin 64 left/right, 40 top, 32 bottom)

| Zone | y | h | Inside |
|---|---|---|---|
| A Status | 40 | 44 | 2 halves, 568 px each |
| B Clock | 84 | 400 | digits box 290 px tall at y+12; date row 64 px; lunar date column 300 px, right |
| C Weather + next 6 hours | 484 | 270 | 2 halves. Weather: value row 120, condition 50, detail 40, credit 30. Hourly: label 48, 6 columns, each rows 34 (hour) / 42 (temp) / 68 (rain bar) / 32 (rain %) |
| D Agenda | 754 | 494 | label row 42; next-event slot 168 (title 2 lines); 2 slots of 72 (1 line); tomorrow slot 92 at the bottom |
| E Tiles | 1248 | 360 | 3 x 2 tiles, each 365 x 156, gap 20. Device tile: label 2 lines max, state 1 line. AC tile: rows 44 / 34 / rest. Top: room name (1 line, "…") + room temperature (auto width, 40 px bold). Middle: "Cảm giác N° · H%" (26 px). Bottom: AC state (1 line) |
| Page dots | 1608 | 40 | |

## Agenda screen

| Zone | h | Inside |
|---|---|---|
| Status | 44 | as Home |
| Header | 120 | title + small clock (220 px column, right) |
| Day 1, 2, 3 | 468 each | day header 64; 5 row slots of 76 |
| Page dots | 40 | |

Row slot columns: time 230 px, title flexible (1 line, "…"), tag 190 px right (calendar name, "N giờ nữa" or "đang diễn ra" on the next event).

## Nhà screen

| Zone | h | Inside |
|---|---|---|
| Status | 44 | as Home |
| Header | 120 | as Agenda |
| Rooms | 1404 | padding-top 32, gap 32. Room card 264 (bedroom 384): row 1 100 (name 52 + feels-like line 34, temp 220 px column, humidity 130 px column); row 2 104 (AC power 300, − 104, setpoint 160, + 104, note rest); bedroom row 3 104 (2 preset toggles, half width each). Up to 4 cards (4 x 264 + bedroom 120 + gaps fits). Overflow line 60 below the last card |
| Page dots | 40 | |

## Template hooks (production HTML)

The canvas HTML is the production template (ADR 0002). Stable hooks:

- `data-zone`: `status`, `clock`, `weather`, `agenda`, `tiles`, `footer` (Home and sleep screen); `header`, `day.0`–`day.2` (Agenda); `header`, `rooms` (Nhà).
- `data-slot`: `agenda.next`, `agenda.1`, `agenda.2`, `agenda.tomorrow` (Home).
- `data-room`: room key on each Nhà card.
- `data-action`: tap regions (interaction.md, "Action ids").

Each zone and slot is one element with a fixed size, so the server can fill data and compute rectangles without layout changes.

## Check for the developer

Render each screen with fixture data that has: an 90-char event title, 0 and 8 events in a day, a 3-digit temperature ("100°" fallback test), a missing value ("—°"), and a 30-char device name. Compare zone rectangles with this table; any difference is a bug.
