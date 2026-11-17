# Dashboard server

Status: ready-for-agent
Blocked by: none

LAN service that fetches Home Assistant, Homebridge, the fan bridge, Open-Meteo and the Google iCal URL, and renders each screen (sleep, Home, Agenda, Nhà) from the approved HTML design (`docs/design/`) to a 1264x1680 8-bit grayscale PNG with headless Chromium. Each screen response also carries its tap regions and actions as JSON. Secrets live only on the server (env file), never in the repo.

Done when: `GET /screen/sleep.png` and `/screen/home.png` match the canvas with real data; `/screen/home.json` lists tap regions; `POST /action/<id>` runs the AC, lamp and fan presets; works from the Mac against the real home.

See ADR 0002.

## Notes

- Font: Be Vietnam Pro (OFL) weights 400, 600, 700, bundled as local `@font-face`; Noto Sans as fallback. No Google Fonts at render time.
- Template hooks: `data-zone`, `data-slot`, `data-room`, `data-action` (docs/design/layout-grid.md "Template hooks"). Action ids: docs/design/interaction.md "Action ids". Grayscale rules: docs/design/visual.md.
- Sleep screen (F0) is the v1 priority: docs/design/screens.md section 0, refresh.md "Sleep screen timing". No actions on it.

## Progress

2026-11-17: `server/` (Node/TS, Playwright, sharp). Sleep screen (F0) renders from fixtures and matches the canvas; lunar date, feels-like and Home agenda rules have tests. Endpoints: `/screen/sleep.png|json`, `/action/<id>`, `/healthz`. Actions (AC via HA, lamp via Homebridge UI API, fan via HAP) are written but not run. Dockerfile and `compose.yaml` written, not built. Left: live run against the real home, calendar URLs, Home/Agenda/Nhà screens (needed by issue 10), deploy.

2026-11-17: live run verified (HA rooms, Homebridge lamp, fan, Open-Meteo). Fan toggle through `/action/fan.bedroom.toggle` verified on the real fan. The fan drops a second command within about 2 s, so actions now update the cache at once and have a 5 s cooldown per device (429 when busy). Deployed with docker compose on the homelab Docker host: `http://192.168.1.102:10060`, all sources OK except the calendar (no iCal URLs yet). AC and lamp actions not run (would change rooms in use). Note: the Claude app terminal panel cannot reach the LAN from Node (macOS Local Network permission); run local servers from another terminal.

2026-11-17: Home and Nhà screens built from the canvas boards and deployed (`/screen/home.*`, `/screen/nha.*`). Shared zones in `server/src/screens/parts.ts`. Home: 7 tap regions; Nhà: 12 (AC toggle and −/+ per room, lamp and fan presets on the bedroom card). Calendar connected (5 feeds). Left: Agenda screen, pending/empty states per section, AC and lamp actions not run.
