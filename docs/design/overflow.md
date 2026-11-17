# Long content and many items

How each screen handles text that is too long and lists that are too long. Zones never grow (layout-grid.md); content is cut, merged or counted. See canvas, row "Long content and many items". All examples are fake.

## Text

| Where | Limit | When too long |
|---|---|---|
| Home next event title | 2 lines | "…" at end of line 2 |
| Home next event detail (time · place) | 1 line | "…" |
| All other event titles (Home slots, Agenda rows, tomorrow row) | 1 line | "…" |
| Date line ("Chủ Nhật, 30 tháng 11") | 1 line | longest real value fits; lunar column is fixed 300 px and cuts with "…" |
| Weather condition line | 1 line | "…". Next-rain text is part of the same line and may be cut |
| Room name (Home AC tile, Nhà card) | 1 line | "…" |
| Device tile label (lamp, fan) | 2 lines | "…" at end of line 2 |
| Device state ("Bật · 100%") | 1 line | "…" |
| Preset toggle name (Nhà) | 1 line | "…"; state text never cut |
| Status line halves | 1 line each | "…" |

Never shrink the font to fit. Never wrap where the slot is 1 line.

## Numbers

- Fixed-width, tabular columns. A value that is out of range (sensor error, for example below 0° or above 60°) shows "—°".
- No data: "—°" / "—%" and "Không có dữ liệu" on the feels-like line.
- Device not reachable: dotted border, "Không phản hồi", not tappable.

## Many items

| Where | Slots | Rule |
|---|---|---|
| Home agenda | 1 next + 2 one-line + tomorrow | All-day events today merge into one slot: "Cả ngày · A · B · +N". Then timed events by start. Hidden timed events: "+N" at the right of the last slot (120 px column). Header count: "còn N sự kiện · M đã qua" |
| Home tomorrow row | 1 | first timed event tomorrow (all-day ignored here) |
| Agenda day | 5 rows | All-day events merge into row 1 ("Cả ngày", tag "N lịch"). Past events drop first. If still too many, row 5 becomes "+N sự kiện (HH:MM–HH:MM)" with the time span of the hidden events |
| Agenda multi-day event | 1 row per day | tag "ngày 2/3" |
| Agenda overlap | normal rows | sort by start, then end. No side-by-side |
| Home tiles | 6 | first 6 in config order; the rest only on the Nhà screen |
| Nhà rooms | 4 cards | first 4 in config order; more: line "+N phòng không hiện. Tối đa 4 phòng trong v1." |
| Nhà bedroom presets | 2 per card | v1 limit; more presets per room are out of v1 |
