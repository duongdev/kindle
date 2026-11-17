# Interaction

## Modes

| Mode | When | Input |
|---|---|---|
| Asleep | Most of the time | None. Touch does not wake the device (research 01). The screen keeps the last frame. RTC wakes redraw it without user input. |
| Awake | After a power-button press | Tap and swipe. Stays awake 60 s after the last input, then goes to Home and sleeps. |

The owner wakes the device with the power button. Status: verified that touch cannot wake; cover sensor and page-turn buttons are asked of the tech lead (needs verification).

## Gestures

| Gesture | Where | Result |
|---|---|---|
| Swipe left | anywhere | Next screen (Home, Agenda, Rooms). Stops at Rooms. |
| Swipe right | anywhere | Previous screen. Stops at Home. |
| Tap | a tile or toggle | Toggle the device, or run the scene. |
| Tap | Agenda footer on Home | Open Agenda screen. |
| Tap | status line | Sync now (Wi-Fi on, fetch all, redraw). |
| Long press | not used in v1 | |
| Page-turn button, top (`RPgFwd`) | awake only | Next screen, same as swipe left. |
| Page-turn button, bottom (`RPgBack`) | awake only | Previous screen, same as swipe right. |

Page-turn buttons do not wake the device (verified). Only the power button and the RTC wake it.

## Frontlight (F15)

Frontlight off while the dashboard runs. The desk has room light; the frontlight costs battery for no gain. Needs verification: auto brightness (powerd `flAuto` = 1) may turn it back on, and the state after sleep.

No hidden gestures for exit. KOReader's menu stays reachable through KOReader's own top-edge tap zone (current plugin behavior; tech lead to confirm it does not conflict with tile taps).

## Home control flow (F9, needs verification)

1. Tap tile. Within one partial refresh, the tile shows pending: thick border and "Đang bật…" / "Đang tắt…". This is the only feedback the owner waits for.
2. Wi-Fi on if off. Send command to Homebridge.
3. Success: tile shows the new state (partial refresh of that tile only).
4. Failure or no answer in 10 s: tile goes back to the old state with "✕ Không gửi được" until the next sync or the next tap. Tap again retries.
5. Wi-Fi stays on while the device is awake, so more taps are fast. Wi-Fi off when the device sleeps.

Target: pending feedback under 300 ms after tap. Result under 5 s with Wi-Fi off at tap time. Tech lead to measure Wi-Fi reconnect time (issue 06 spike logs it).

Debounce: ignore taps on the same tile while it is pending.

Homebridge login token lasts 8 h. Log in again silently on expiry; the owner never sees a login.

### Control model: preset toggles

Each control has two states: OFF, or ON with a saved state. One tap moves between them. No sliders, no multi-step controls (except the AC setpoint). This fits e-ink: one tap, one state change, one partial refresh.

| Control | OFF | ON (preset) | Characteristics | Status |
|---|---|---|---|---|
| AC preset (per room; Home tile and Nhà power button) | `hvac_mode` off | `hvac_mode` cool, `temperature` 22, `fan_mode` auto. Same for every room (all 3 ACs offer auto/cool/off and fan auto) | Home Assistant `climate` entity (rooms named there), or Homebridge HeaterCooler `Active` | Verified API, not run on the device |
| AC setpoint (per room) | | −/+ 1° per tap, range 16–30° | HA `climate.set_temperature`, or Homebridge `CoolingThresholdTemperature` | Verified API, not run on the device |
| Đèn ngủ (bedroom lamp) | `On` false | `On` true + `Brightness` 10 | Homebridge Yeelight Lightbulb | Research-verified |
| Quạt (bedroom fan) | `Active` 0 | `Active` 1 + `Swing Mode` 0 + speed switch "Mid" on | homebridge-xiaomi-fan child bridge, over HAP (plain HTTP) | Verified: read and write (write about 5 ms) |

Rules:

- AC: tap when off applies the preset. Tap when on in any state (cool 25°, dry, …) turns it off. The Nhà screen −/+ still adjusts the setpoint (owner decision, 2026-11-17); the next preset tap sets 22° again.
- Fan: "ON in another state" means any speed switch other than Mid, or swing on. Tap turns it off, as for the lamp. Buzzer, LED and child lock are out of v1.
- Tap when the device is ON in any state (for example the lamp at 50% from the phone): turn OFF. Tap when OFF: apply the preset. The label shows the real state ("Bật · 50%") until the next tap.
- Presets live in the config file.
- AC is IR, one-way: the shown state is the last command, not measured. Label "theo lệnh cuối". If someone uses the remote, the screen is wrong until the next command.
- Setpoint taps change the number at once (partial refresh). Send one command 2 s after the last tap.

## Action ids (tap regions)

Runtime (ADR 0002): the server renders each screen to a PNG and turns every element with `data-action` into a tap region. Ids are stable; rooms come from config (`living`, `bedroom`, `office`, …).

| Action id | Where | Does |
|---|---|---|
| `sync.now` | status line, screens 1–3 | Wi-Fi on, fetch all, redraw |
| `nav.agenda` | Home agenda zone | open Agenda screen |
| `ac.<room>.toggle` | Home AC tile; Nhà card AC button | OFF ↔ preset (cool, 22°, fan auto) |
| `ac.<room>.temp.down` | Nhà card "−" | setpoint −1° (debounced 2 s) |
| `ac.<room>.temp.up` | Nhà card "+" | setpoint +1° (debounced 2 s) |
| `lamp.bedroom.toggle` | Home tile; Nhà bedroom card | OFF ↔ ON at 10% |
| `fan.bedroom.toggle` | Home tile; Nhà bedroom card | OFF ↔ ON, Mid, no swing |
| `nav.next` / `nav.prev` | swipe left/right, page-turn buttons | next / previous screen (not a tap region) |

The sleep screen has no actions.

## Settings (v1, file-based)

No settings screen in v1. A config file in the plugin folder: rooms and order, which accessories are tiles, scenes, calendar URL, location, night window, clock interval. The owner edits it over SSH.
