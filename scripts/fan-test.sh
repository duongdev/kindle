#!/bin/sh
# One-off check: can a LAN client control the Bedroom Fan through its Homebridge child bridge?
# Turns the fan ON (no swing, Mid speed), waits, reads back, then turns it OFF.
# Needs private/homebridge.env (HB_URL, HB_USER, HB_PASS); the bridge PIN is read from the UI API, never printed.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
. "$ROOT/private/homebridge.env"
FAN=${FAN_URL:-http://192.168.1.38:56633}
# aid 5: iid 4 Active, iid 7 Swing Mode, iid 20 "Mid" speed switch (from GET /accessories).

TOKEN=$(curl -fsS -m 10 -H 'Content-Type: application/json' \
  -d "{\"username\":\"$HB_USER\",\"password\":\"$HB_PASS\"}" "$HB_URL/api/auth/login" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
PIN=$(curl -fsS -m 10 -H "Authorization: Bearer $TOKEN" "$HB_URL/api/status/homebridge/child-bridges" |
  python3 -c 'import json,sys; print(next(b["pin"] for b in json.load(sys.stdin) if b["identifier"] == "xiaomifan"))')

put() {
  curl -sS -m 10 -o /dev/null -w "PUT %{http_code} in %{time_total}s\n" -X PUT \
    -H "Authorization: $PIN" -H 'Content-Type: application/hap+json' -d "$1" "$FAN/characteristics"
}
read_state() {
  curl -sS -m 10 -H "Authorization: $PIN" "$FAN/characteristics?id=5.4,5.7,5.20"; echo
}

echo "before:"; read_state
put '{"characteristics":[{"aid":5,"iid":4,"value":1},{"aid":5,"iid":7,"value":0},{"aid":5,"iid":20,"value":true}]}'
sleep 5
echo "after ON:"; read_state
put '{"characteristics":[{"aid":5,"iid":4,"value":0}]}'
sleep 3
echo "after OFF:"; read_state
