# Data sources for the dashboard

Researched 2026-11-17. Target: KOReader v2026.07.1 on KOA3, plugin in Lua, Wi-Fi on only during a sync.

## Homebridge: read and control accessories

The Homebridge UI (homebridge-config-ui-x, latest v5.30.1, 2026-11-13) has a REST API. Swagger docs are on the device at `/swagger`, for example `http://homebridge.local:8581/swagger`.

- Login: `POST /api/auth/login` with `username`, `password`, optional `otp`. Returns `{access_token, token_type: "Bearer", expires_in}`.
- No-auth token: `POST /api/auth/noauth` works ONLY when UI auth is set to `none`. Otherwise it returns 401.
- `GET /api/auth/check` tells if a token is still valid. `POST /api/auth/refresh` gives a new token.
- Token lifetime: JWT `expiresIn` = `ui.sessionTimeout` (seconds). Default 28800 (8 h) with form auth, 1296000 (15 days) with auth `none`. Set `sessionTimeout` in the UI config to change it.
- Refresh tokens keep the first `sessionStartedAt`, so the renewal chain can have a maximum age. The exact cap is not checked. Simplest: log in again at each sync.
- Accessories: `GET /api/accessories` (list), `GET /api/accessories/{uniqueId}` (one), `PUT /api/accessories/{uniqueId}` with body `{"characteristicType": "On", "value": true}`. All need `Authorization: Bearer <token>`.
- Each item is a HAP service: `uniqueId`, `serviceName`, `humanType`, `values`, and `serviceCharacteristics[]` with `type`, `value`, `format`, `unit`, `canWrite`.
- Insecure mode is required. Without it the accessories calls return 400 "Homebridge must be running in insecure mode to access accessories."
- `hb-service` starts Homebridge with `-I` by default. The UI setting "Insecure mode (-I)" can turn it off. Docker uses `HOMEBRIDGE_INSECURE=1`.
- Transport is plain HTTP on the LAN. No TLS is needed on the Kindle.

Minimal sequence:

```
POST http://<hb>:8581/api/auth/login   {"username":"...","password":"..."}  -> access_token
GET  http://<hb>:8581/api/accessories  Authorization: Bearer <token>        -> list, find uniqueId
PUT  http://<hb>:8581/api/accessories/<uniqueId>  {"characteristicType":"On","value":true}
```

Sources:
- https://github.com/homebridge/homebridge-config-ui-x/releases/tag/v5.30.1
- https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/core/auth/auth.controller.ts
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/core/auth/auth.service.ts (`signIn`, `generateNoAuthToken`)
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/core/auth/auth.module.ts (`signOptions.expiresIn`)
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/core/config/config.service.ts (sessionTimeout defaults, `homebridgeInsecureMode`)
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/modules/accessories/accessories.controller.ts
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/modules/accessories/accessories.dto.ts
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/modules/accessories/accessories.service.ts (insecure check)
- https://github.com/homebridge/homebridge-config-ui-x/blob/v5.30.1/src/bin/hb-service.ts (`homebridgeOpts = ['-I']`)
- https://github.com/homebridge/hap-client/blob/latest/src/interfaces.ts (`ServiceType`, `CharacteristicType`)

## Homebridge: alternatives

- Direct HAP in insecure mode: the bridge itself answers plain HTTP `GET /accessories` and `GET /characteristics?id=aid.iid` without pairing, and `PUT /characteristics` with header `Authorization: <bridge PIN>`. This is what the UI uses internally. No JWT, but you must know the bridge port, and each child bridge has its own port and PIN.
  - https://github.com/homebridge/HAP-NodeJS/blob/latest/src/lib/HAPServer.ts (`allowInsecureRequest`, PIN check on PUT)
  - https://github.com/homebridge/hap-client/blob/latest/src/index.ts (`http://ip:port/accessories`, `Authorization` = pin)
- Secure HAP (pair-setup with SRP, then ChaCha20-Poly1305 sessions): too much crypto to write in Lua. Not recommended.
- homebridge-http-webhooks (GPL-3.0, last push 2025-03): exposes its OWN virtual accessories over HTTP GET. It does not control accessories from other plugins, so it is not a fit.
  - https://github.com/benzman81/homebridge-http-webhooks

## Google Calendar secret iCal address

- `http://calendar.google.com/...basic.ics` returns 301 to `https://`. The host sends HSTS with `preload`. So HTTPS is required. (Tested 2026-11-17 with curl on a public Google calendar.)
- The server accepts TLS 1.2 (tested with `curl --tls-max 1.2`, 2026-11-17).
- LuaSec's `https.request` returns "redirect not supported" if you ask it to follow redirects. Use the exact `https://` URL.
  - https://github.com/brunoos/luasec/blob/v1.3.2/src/https.lua
- The feed holds raw `VEVENT`s with `RRULE`, `EXDATE`, `RECURRENCE-ID`, and `TZID` values. Recurring events must be expanded by the client.

### Pure-Lua RRULE options

No complete, maintained pure-Lua RRULE expander was found.

- simoneSantoni/ical.nvim `rrule.lua` (MIT, 0 stars): FREQ, COUNT, UNTIL, BYDAY, BYMONTHDAY only. Uses `vim.*` APIs. https://github.com/simoneSantoni/ical.nvim/blob/HEAD/lua/ical/rrule.lua
- atiladefreitas/bloocky `sync/rrule.lua` (MIT): partial by design. It rejects ordinal BYDAY and other parts. https://github.com/atiladefreitas/bloocky/blob/HEAD/lua/bloocky/sync/rrule.lua
- MParolari/lua-ical (GPL-3.0, last push 2016): parser only. https://github.com/MParolari/lua-ical

### LAN proxy

A small service on the Homebridge box can fetch the `.ics`, expand it, and return flat JSON for the next N days. Python `recurring-ical-events` v3.8.2 (LGPL-3.0, 2026-04-30) handles RRULE, EXDATE, RECURRENCE-ID and time zones.
- https://github.com/niccokunzmann/python-recurring-ical-events

The proxy also keeps the secret iCal URL off the Kindle, removes TLS from the device, and makes the payload small.

## Weather: Open-Meteo

- Plain HTTP works: `http://api.open-meteo.com/v1/forecast?...` returned 200 with JSON, no redirect (tested 2026-11-17). The docs show `https://` only, so plain HTTP is not a documented promise.
- No API key for the free tier.
- Free tier is for non-commercial use only. Limits: under 10,000 calls per day, 5,000 per hour, 600 per minute (300,000 per month). Data is CC BY 4.0, so show "Weather data by Open-Meteo.com".
  - https://open-meteo.com/en/terms
  - https://open-meteo.com/en/docs

Example for Ho Chi Minh City (about 1.6 KB response, tested 2026-11-17):

```
http://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297
  &current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m
  &hourly=temperature_2m,precipitation_probability,weather_code
  &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset
  &timezone=Asia%2FHo_Chi_Minh&forecast_days=3&forecast_hours=12
```

`weather_code` is a WMO code. Map it to an icon on the device.

## Vietnamese lunar calendar (âm lịch)

- Hồ Ngọc Đức's algorithm is the standard one. It computes new moons and solar terms with `timeZone = 7`. A UTC+8 (Chinese) library gives wrong days some years, so use a Vietnamese one.
  - https://www.xemamlich.uhm.vn/calrules.html (mirror; the original `informatik.uni-leipzig.de/~duc/amlich/` now returns 404)
- The algorithm is about 150 lines of math (`jdFromDate`, `getNewMoonDay`, `getSunLongitude`, `getLunarMonth11`, `getLeapMonthOffset`, `convertSolar2Lunar`). It uses only `floor` and `sin`, so it ports to Lua directly.
- Licence of the author's reference code: "Permission to use, copy, modify, and redistribute ... for personal, non-commercial use", with the copyright notice kept. OK for this personal device. Not open source in the OSI sense.
  - https://www.xemamlich.uhm.vn/JavaScript/amlich-hnd.js (header)
- Existing Lua port: hhoangg/kindleui.koplugin `kindleui_lunar.lua`, pure Lua, `math` only, TIMEZONE = 7. Licence AGPL-3.0, 3 stars. Single small repo: treat as weak, and test against known Tết dates.
  - https://github.com/hhoangg/kindleui.koplugin/blob/HEAD/kindleui_lunar.lua

## KOReader TLS (luasec)

What v2026.07.1 ships:
- LuaSec v1.3.2 on LibreSSL 4.3.2.
  - https://github.com/koreader/koreader-base/blob/6e4bc81af4e04f78d81677a323a780a71b29702a/thirdparty/luasec/CMakeLists.txt
  - https://github.com/koreader/koreader-base/blob/6e4bc81af4e04f78d81677a323a780a71b29702a/thirdparty/libressl/CMakeLists.txt
- CA bundle: Mozilla roots from certifi 2026.6.17, installed as `data/ca-bundle.crt`. In this release only curl is set to use it.
  - https://github.com/koreader/koreader-base/blob/6e4bc81af4e04f78d81677a323a780a71b29702a/thirdparty/certifi/CMakeLists.txt
  - https://github.com/koreader/koreader-base/blob/6e4bc81af4e04f78d81677a323a780a71b29702a/thirdparty/curl/CMakeLists.txt
- LuaSec default config: `protocol = "any"`, no SSLv2/v3/TLS 1.0, `verify = "none"`. So in v2026.07.1, `ssl.https` does NOT check the certificate unless the plugin passes `cafile = "data/ca-bundle.crt", verify = "peer"` in the request table. TLS 1.2 and 1.3 are available.
  - https://github.com/brunoos/luasec/blob/v1.3.2/src/https.lua
- `socketutil` sets `http.TIMEOUT`/`https.TIMEOUT` and has `set_timeout(block, total)`. Use it so a slow handshake does not block the UI.
  - https://github.com/koreader/koreader/blob/v2026.07.1/frontend/socketutil.lua

Upcoming change:
- koreader-base PR #2564 (merged 2026-10-23, after v2026.07.1): LuaSec bf47708, prefers `data/ca-bundle.crt`, checks hostname, verifies the certificate by default. Expect this in the next stable.
  - https://github.com/koreader/koreader-base/pull/2564
- Issue #16398 (open, 2026-11): nightlies after this change give "certificate verify failed" for some self-hosted servers. Cause not confirmed.
  - https://github.com/koreader/koreader/issues/16398

Known issues:
- `ssl.https` refuses HTTP proxies ("proxy not supported"). Matters only if you route through a proxy, for example Tailscale userspace mode.
  - https://github.com/koreader/koreader/issues/16242
  - https://github.com/koreader/koreader/issues/14693
- `wantread` errors mean a timeout during the TLS handshake. Reports are on Kobo and Kindle over weak Wi-Fi. Weak (maintainer comment, not a root cause).
  - https://github.com/koreader/koreader/issues/13707
  - https://github.com/koreader/koreader/issues/12097
- No Kindle-specific luasec bug was found in koreader issues.

## Recommendation

- Homebridge: use the UI REST API over plain HTTP on the LAN. Log in at each sync, `GET /api/accessories`, `PUT /api/accessories/{uniqueId}` to toggle. Confirm insecure mode is on (default with hb-service). Store a dedicated non-admin UI user on the device. Keep direct HAP insecure HTTP as a fallback if the JWT flow is a problem.
- Calendar: run a tiny LAN proxy on the Homebridge box (Python + `recurring-ical-events`) that returns flat JSON for the next 7 days over plain HTTP. Do not parse RRULE in Lua.
- Weather: call Open-Meteo directly. Plain HTTP works today; if it stops, move the call into the same LAN proxy. One call per sync is far below the limits.
- Lunar: port Hồ Ngọc Đức's algorithm to Lua (about 150 lines, TZ = 7), keep his copyright notice, and add a check against known Tết dates.
- TLS: avoid HTTPS on the Kindle where possible. Put all internet fetches behind the LAN proxy, so the device speaks only plain HTTP on the LAN. If a plugin must use `ssl.https` directly, pass `cafile = "data/ca-bundle.crt"`, `verify = "peer"`, and set `socketutil` timeouts. This also matches the default after KOReader PR #2564.

## Checks on the real home setup (2026-11-17)

Run from the Mac on the same LAN. Snapshots are in `private/fixtures/` (gitignored).

- Room ACs and Aqara temperature/humidity sensors are in Home Assistant, not in Homebridge. HA `GET /api/states` with a long-lived token returns them. HA areas (through `POST /api/template` with `area_name()`) map sensors to rooms.
- HA climate entities offer `hvac_modes` auto/cool/off and `fan_modes` auto/low/medium/high. The AC preset (cool, 22 C, fan auto) fits all three. Writes through HA are not tested yet.
- IR-controlled ACs report the setpoint as `CurrentTemperature`. Do not show it as room temperature.
- The Yeelight lamp is in the Homebridge UI API (`/api/accessories`).
- The Xiaomi fan child bridge is missing from `/api/accessories`. Its HAP server answers plain HTTP: `GET /accessories` and `GET /characteristics` need no auth in insecure mode. `PUT /characteristics` with header `Authorization: <bridge PIN>` returned 204 in about 5 ms, and the state read back as set. Verified: on, no swing, Mid speed, then off.
