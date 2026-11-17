#!/bin/sh
# Pull real data into private/fixtures/ (gitignored) for design mockups and the emulator.
# Usage: sh scripts/snapshot.sh [weather|homebridge|ha|all]
# Homebridge needs private/homebridge.env with HB_URL, HB_USER, HB_PASS.
# Home Assistant needs private/ha.env with HA_URL, HA_TOKEN (a long-lived access token).
# The calendar comes from the Google Calendar connector in Claude, not from this script.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/private/fixtures"
mkdir -p "$OUT"

weather() {
  curl -fsS -m 15 -o "$OUT/weather.json" \
    'http://api.open-meteo.com/v1/forecast?latitude=10.82&longitude=106.63&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=Asia%2FBangkok&forecast_days=3'
  echo "weather -> $OUT/weather.json"
}

homebridge() {
  ENV="$ROOT/private/homebridge.env"
  [ -f "$ENV" ] || { echo "missing $ENV (HB_URL, HB_USER, HB_PASS)"; exit 1; }
  . "$ENV"
  TOKEN=$(curl -fsS -m 10 -H 'Content-Type: application/json' \
    -d "{\"username\":\"$HB_USER\",\"password\":\"$HB_PASS\"}" "$HB_URL/api/auth/login" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
  curl -fsS -m 15 -H "Authorization: Bearer $TOKEN" -o "$OUT/homebridge.json" "$HB_URL/api/accessories"
  echo "homebridge -> $OUT/homebridge.json"
  # Child bridges and plugin names show devices missing from /api/accessories.
  curl -fsS -m 15 -H "Authorization: Bearer $TOKEN" "$HB_URL/api/status/homebridge/child-bridges" |
    python3 -c 'import json,sys; print(json.dumps([{k: v for k, v in b.items() if k not in ("pin", "setupUri")} for b in json.load(sys.stdin)], indent=1))' \
    > "$OUT/homebridge-child-bridges.json" && echo "child bridges -> $OUT/homebridge-child-bridges.json"
  curl -fsS -m 15 -H "Authorization: Bearer $TOKEN" "$HB_URL/api/plugins" |
    python3 -c 'import json,sys; print(json.dumps([{k: p.get(k) for k in ("name","installedVersion","disabled")} for p in json.load(sys.stdin)], indent=1))' \
    > "$OUT/homebridge-plugins.json" && echo "plugins -> $OUT/homebridge-plugins.json"
}

ha() {
  ENV="$ROOT/private/ha.env"
  [ -f "$ENV" ] || { echo "missing $ENV (HA_URL, HA_TOKEN)"; exit 1; }
  . "$ENV"
  curl -fsS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" |
    python3 -c 'import json,sys
keep = ("friendly_name","unit_of_measurement","device_class","percentage","preset_mode","oscillating","brightness","current_temperature","temperature","hvac_modes","fan_mode","fan_modes","hvac_action")
print(json.dumps([{"entity_id": s["entity_id"], "state": s["state"], **{k: s["attributes"][k] for k in keep if k in s["attributes"]}} for s in json.load(sys.stdin)], ensure_ascii=False, indent=1))' \
    > "$OUT/ha-states.json"
  echo "ha -> $OUT/ha-states.json"
  # Areas are not in /api/states; a read-only template call maps climate and sensor entities to rooms.
  curl -fsS -m 15 -H "Authorization: Bearer $HA_TOKEN" -H 'Content-Type: application/json' \
    -d '{"template":"{% set ns = namespace(o=[]) %}{% for s in states.climate | list + states.sensor | selectattr(\"attributes.device_class\",\"in\",[\"temperature\",\"humidity\"]) | list %}{% set ns.o = ns.o + [{\"entity_id\": s.entity_id, \"area\": area_name(s.entity_id), \"device\": device_attr(s.entity_id, \"name\")}] %}{% endfor %}{{ ns.o | tojson }}"}' \
    "$HA_URL/api/template" > "$OUT/ha-areas.json"
  echo "areas -> $OUT/ha-areas.json"
}

case "${1:-all}" in
  weather) weather ;;
  homebridge) homebridge ;;
  ha) ha ;;
  all) weather; homebridge; ha ;;
  *) echo "usage: $0 [weather|homebridge|ha|all]"; exit 2 ;;
esac
