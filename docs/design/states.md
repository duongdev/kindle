# States

See canvas, "States".

## Tile states

| State | Look | Copy |
|---|---|---|
| Off | White, 3 px black border | name, "Tắt" |
| On | Black fill, white text | name, "BẬT" |
| Scene | White, 3 px dashed border | name, "Chạy" |
| Scene sent | White, 6 px dashed border, 3 s | name, "Đã gửi" |
| Pending | White, 6 px border | "Đang bật…" / "Đang tắt…" / "Đang chạy…" |
| Failed | Old state, bold error line | "✕ Không gửi được" |
| Unreachable | Dotted border, gray text | "Không phản hồi" (Homebridge says the accessory is not responding) |

State must not rely on gray alone: on/off is black vs white, the rest change border style and text.

## Status line

| Case | Look | Copy |
|---|---|---|
| Normal | Gray text | "Cập nhật 10:20" · "Wi‑Fi tắt · Pin 82%" |
| Syncing | Black text | "Đang cập nhật…" · "Wi‑Fi bật · Pin 82%" |
| Stale (last good sync over 1 h old) | Inverted | "Dữ liệu cũ · cập nhật lúc 07:40" · "Không có mạng" |
| Low battery (15% or less) | Inverted | "Pin 9% · Hãy sạc" |
| Charging | Gray text | "Đang sạc · 64%" |
| Night | Gray text | "Nghỉ đêm · bấm nút nguồn để xem" |

Priority when several apply: low battery, stale, syncing, night, normal.

## Pending and empty, per section

See canvas, "Pending + empty, per section".

- **Pending** = first load with no cache (after install or restart). Placeholders are dashed outlines plus one "Đang …" line. Never gray fills: they ghost and cost a bigger refresh. When a cache exists, show the cache instead of pending.
- **Empty** = data loaded fine, nothing to show, or the source is not set up in the config file. Copy says what is missing and where to fix it.

| Section | Pending | Empty |
|---|---|---|
| B Clock | "--:--" + "Đang lấy giờ…" (time unknown before first sync) | Not used |
| C Weather | Dashed icon + value boxes, "Đang tải thời tiết…" | "Chưa đặt vị trí" + config hint |
| C Next 6 hours | Dashed columns, "Đang tải thời tiết…" | Not used (comes with weather) |
| D Agenda (Home) | 3 dashed rows, "Đang tải lịch…" | Nothing left today: "Hôm nay trống" + first event tomorrow. Nothing in 7 days: "Không có sự kiện trong 7 ngày tới". No calendar URL: "Chưa kết nối lịch" |
| E Tiles | Tile names (from config), dashed border, "Đang tải…". Not tappable until the state is known | No tiles chosen: one wide box "Chưa chọn thiết bị". Fewer than 6: blank slots, grid keeps its place |
| Agenda screen, one day | Dashed rows, "Đang tải lịch…" | "Không có sự kiện" |
| Nhà screen, room card | Room name (from config), dashed value boxes and controls. AC button shows "Máy lạnh"; "Đang tải…" goes in the note column (300 px button is too narrow for both) | No sensor configured: temp and humidity columns blank (not an error). No AC: row 2 blank |
| Nhà screen, whole | | "Chưa kết nối Homebridge" + "Thời tiết và lịch vẫn hoạt động." |

Each section moves out of pending on its own; one slow source does not hold the others.

## Room card states

Card size never changes (264 px, bedroom 384 px). See canvas, "Pending + empty, per section".

| Case | Row 1 right side | Controls |
|---|---|---|
| Sensor + AC | "28,5°" and "65%" | normal |
| No sensor configured (current state: room sensors are paired to Apple Home through the Aqara hub, not Homebridge) | blank | normal |
| Sensor configured, no reading for over 1 h | "—°" and "Không có dữ liệu" | normal |
| Pending | dashed boxes | dashed, "Đang tải…" |
| Preset device unreachable (for example the fan) | | dotted border, "Không phản hồi", not tappable |
| Preset device on in another state | | black, real state ("Bật · 50%"); tap turns it off |

## Section fallbacks

Each section renders from cache when its fetch fails (offline-first, as kdashboard). It shows its own short message only when there is no cache.

| Section | No data | Fetch failed, cache exists |
|---|---|---|
| Agenda | "Không tải được lịch" | Show cache; status line goes stale after 1 h |
| Agenda, nothing today | "Hôm nay trống" + first event tomorrow | |
| Weather | "—°" + "Chưa có dữ liệu" | Show cache |
