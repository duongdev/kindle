# Dashboard server

Renders the dashboard screens to 1264x1680 grayscale PNGs for the Kindle (ADR 0002) and runs home actions.

## Run

- Fixtures (no network): `CONFIG=../private/server-config.json FIXTURES=../private/fixtures pnpm start`
- Real home, on the Mac: `sh scripts/server-live.sh` (reads `private/*.env`)
- One PNG to a file: `pnpm render sleep out/sleep.png` (same env; `NOW=...` fixes the time)
- Tests and checks: `pnpm test`, `pnpm check`

## API

| Method | Path | Does |
|---|---|---|
| GET | `/screen/<sleep|home|nha>.png?batt=82&charging=0&wifi=0&next=<epoch>` | Screen PNG |
| GET | `/screen/<name>.raw` | Same screen as framebuffer bytes (1280x1680 Y8) for the Kindle |
| GET | `/screen/<name>.json` | Tap regions (`data-action` rectangles) |
| POST | `/action/<id>` | Action ids from `docs/design/interaction.md` |
| GET | `/healthz` | Source status |

## Config

`config.example.json` shows the shape (fake ids). The real file is `private/server-config.json`. Secrets come from the environment only: `HA_URL`, `HA_TOKEN`, `HB_URL`, `HB_USER`, `HB_PASS`, `CALENDARS` (`Name|https://...ics;...`).

## Deploy

Runs on the homelab Docker host (`ssh duongdev@portainer`, LAN IP 192.168.1.102) in `~/kindle-dashboard`, host port 10060. Plain `docker compose`, not a Portainer-managed stack.

1. `rsync -a --exclude node_modules --exclude out --exclude .env --exclude config.json server/ duongdev@portainer:kindle-dashboard/`
2. First time only: copy `private/server-config.json` to `config.json`, and the `private/*.env` files into `.env` (mode 600).
3. `ssh duongdev@portainer 'cd ~/kindle-dashboard && docker compose up -d --build'`
4. Check: `curl http://192.168.1.102:10060/healthz`

`.env` and `config.json` are in `.dockerignore`, so they never go into the image.
