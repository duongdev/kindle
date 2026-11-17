# Screens

Screen: 1264 x 1680 px portrait, 300 DPI. Side margin 64 px. All copy is Vietnamese. All values below are sample data.

Order: Home, Agenda, Nhà (home control). Swipe left goes to the next screen, swipe right goes back. After 60 s without input, the device goes back to Home before it sleeps (Home is the sleep frame).

## 0. Sleep screen (Home while asleep)

Likely runtime (tech lead, not yet confirmed with the owner): the owner uses the stock Kindle home most of the time; the dashboard is drawn as the Kindle sleep screen and refreshes every 20–30 min (tunable). No touch while asleep. The interactive screens (1–3) open from a launcher on the Kindle home.

Same zone grid as Home (layout-grid.md); only the content of B and E changes:

- **B, no clock.** A clock that can be 30 min wrong is worse than none. Zone B shows weekday (180 px), full date and lunar date, then "Cập nhật lúc 10:20" (bold) and "lần tới khoảng 10:50".
- **A status line** left: "Đang ngủ · màn hình chờ".
- **D agenda:** no countdown ("3 giờ nữa"); the next event shows its start time and "tiếp theo". Absolute times only.
- **E, status cells, not buttons.** Same 3 x 2 grid and content (room temp, feels-like, AC state; lamp; fan), but no button borders: a 2 px top rule per cell. Nothing looks tappable.
- **Footer** (replaces page dots): "Bấm nút nguồn để mở Kindle · Dashboard trong thư viện".
- Data age must be clear: the update time in B is the main signal; the status line goes inverted when data is stale (states.md).

## 1. Home (the glance screen)

Top to bottom. Heights are fixed (layout-grid.md).

| Zone | Height | Content |
|---|---|---|
| A Status | 44 px | Left: last sync time ("Cập nhật 10:20"). Right: Wi-Fi state and battery ("Wi‑Fi tắt · Pin 82%"). |
| B Clock | 400 px | HH:MM, 290 px bold, tabular digits, 24 h. Below: weekday and date ("Thứ Ba, 17 tháng 11"), lunar date on the right ("Âm lịch 9/10"). |
| C Weather + rooms | 270 px | Left half: icon, temperature now, condition + next rain time ("Nắng · Mưa lúc 15:00"), high, low, "Cảm giác" (feels like), credit "Nguồn: Open-Meteo" (22 px, required by CC BY 4.0). Right half: "6 GIỜ TỚI · MƯA", 6 hourly columns: hour, temperature, rain bar (black fill = chance), rain %. |
| D Agenda | 494 px | "HÔM NAY" and count ("còn 1 sự kiện · 2 đã qua"). Next-event slot inverted (black). Then 2 one-line slots. Bottom: first event tomorrow. |
| E Tiles | 2 x 156 px | 3 x 2 grid. Owner picks from config. Default: 3 AC tiles, Đèn ngủ, Quạt phòng ngủ; 6th slot blank. AC tile: room name and room temperature on top ("Phòng ngủ 30°"), room feels-like and humidity in the middle ("Cảm giác 34° · 70%"), AC state below ("Máy lạnh: Tắt" or "Máy lạnh: Lạnh 25°"). Tap toggles OFF / preset (interaction.md). Setpoint −/+ only on the Nhà screen. |
| Page dots | 40 px | 3 dots, current filled. |

Zone and slot sizes: layout-grid.md. Zones never move.

Agenda slots on Home: one next-event slot (black, title up to 2 lines, "N phút nữa" under the time), then 2 one-line slots, then the first event tomorrow at the bottom. Free slots stay blank.

Rules:

- Past events drop off. An event in progress stays in the black row with "đang diễn ra" until it ends.
- All-day events show as "Cả ngày" and do not take the black row.
- More than 3 events left today: the last one-line slot shows "+N sự kiện".
- Room temperatures are on the Nhà screen, not on Home (zone C keeps the 6-hour rain strip). Needs verification: room sensors.

## 2. Agenda

- Header: "Lịch" and a small clock (64 px). The small clock updates on the same rule as the big clock.
- Today, tomorrow, the day after. Each day: header "HÔM NAY · THỨ BA 17/11", then rows: time range (230 px column) and title. Second line for location when present.
- Past events today: struck through, gray text.
- Next event: black row, same as Home.
- Empty day: "Không có sự kiện".
- Each day has a fixed block with 5 row slots (layout-grid.md). Overflow: the 5th slot shows "+N sự kiện". No scroll in v1.

## 3. Nhà (home control)

Built around what the owner uses every day. Everything else is out of v1.

- Header: "Nhà" and small clock. Status line left: "Trạng thái lúc HH:MM".
- One card per room (fixed order from config, up to 4; see overflow.md). Card:
  - Row 1: room name, temperature in whole degrees (80 px), humidity. From the room sensor in Home Assistant. Under the name: room feels-like ("Cảm giác 35°").
  - Row 2: AC power (BẬT/Tắt), "−", setpoint ("22°", label "đặt"), "+", note "theo lệnh cuối".
  - Bedroom only, row 3: two preset toggles: "Đèn ngủ" and "Quạt".
- Preset toggle: OFF, or ON with a saved state. Đèn ngủ ON = 10% brightness. Quạt ON = speed 2, no oscillation. Label shows the ON state ("BẬT · 10%", "BẬT · số 2").
- Fixed card sizes: layout-grid.md.
- Out of v1: AC mode and fan speed, lamp brightness slider and colour, power strip, the other light, scenes.

## Calendar data rules

From the real feed shape (calendar, title, start, end, all_day, status). Examples are fake.

- **Calendars shown**: the owner picks feeds in config (personal, work feeds, Vietnamese holidays). The lunar feed is not shown as events; the lunar date comes from the local calculation (F4). The feed may be used to check it.
- **Cancelled**: hide events whose title starts with "Canceled:" or "Đã hủy:", and events with status `cancelled`.
- **Tentative** (`status: tentative`): show with "?" before the title. On Home's next-event slot, add "? Chưa xác nhận" under the title. Tentative events can take the next-event slot.
- **Long titles**: up to about 90 characters in real data. Home next-event: 2 lines, then "…". Everywhere else: 1 line, then "…". Never shrink the font.
- **Overlap**: events that overlap (for example 09:00–09:30 and 09:15–09:30) list by start time, then by end time. No side-by-side layout.
- **Repeated short events** (daily 15-min standups): normal rows. When a day has more events than slots, drop past events first, then show "+N sự kiện" in the last slot.
- **All-day**: "Cả ngày" in the time column, listed first in the day. Multi-day all-day events show on each day with "ngày 2/3" in the tag column. Example: "Báo cáo quý · ngày 2/3".
- **Calendar tag** (Agenda screen only): short calendar name from config, for example "Cá nhân", "Công ty". Home shows no tags.
- **Day header**: weekday, date and lunar date ("THỨ TƯ 18/11 · ÂL 10/10"). Lunar day 15 shows "ÂL RẰM/10", day 1 "ÂL MÙNG 1/10" (same rule as Home: "Âm lịch Rằm/10").

## Room feels-like

- Heat index from room temperature and humidity, computed on the device (not the Home Assistant thermal_comfort entities). Full NOAA algorithm: the simple Steadman formula first; the Rothfusz regression only when that result is 80 °F (26.7 °C) or more; then NOAA's low- and high-humidity adjustments. Round to whole degrees. At cool room temperatures the result is about equal to the temperature.
- Example (fake): 29,5° and 75% gives "Cảm giác 35°".
- Shown on the Home AC tile and under the room name on the Nhà card.

## Weather data rules

- Current temperature, rounded. Condition from WMO code (Vietnamese label table in the implementation).
- "Cảm giác N°" (apparent temperature) on the detail line. In Ho Chi Minh City it is often 5° above the air temperature, so it matters.
- "Mưa lúc HH:00": first hour today with rain chance 50% or more. None: "Không mưa".
- High and low for today, rounded.

## Out of scope for v1

Reading books, notifications, music control, multiple calendars with colors, editing events, thermostat set-point control (toggle only).
