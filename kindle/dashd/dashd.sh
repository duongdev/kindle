#!/bin/sh
# Sleep-screen daemon (issue 08, ADR 0002). Draws the server's sleep PNG when the stock UI goes to sleep,
# and asks powerd to wake the device every INTERVAL seconds to draw a fresh one.
# Run by hand from SSH: see docs/procedures/sleep-screen-daemon.md.
# It also handles sleep while KOReader (the dashboard viewer) is open: KOReader's sleep screen is set to
# "Leave screen as-is" with no message, so KOReader draws nothing at sleep and sets no wake alarm of its own.
# Start it from a /tmp copy: USB drive mode unmounts /mnt/us.

SERVER=${SERVER:-http://192.168.1.102:10060}
INTERVAL=${INTERVAL:-1800}          # 90 for quick tests
NIGHT_START=${NIGHT_START:-0}       # hours; no refresh from NIGHT_START to NIGHT_END (equal: no night)
NIGHT_END=${NIGHT_END:-6}
MAX_INTERVAL=3500                   # below 3600 s so powerd does not hibernate
LOW_BATT=5
DEFER=${DEFER:-0}                   # 1: ask powerd to suspend right after our alarm is set (experiment)
DIR=/mnt/us/dashd
STOP=$DIR/STOP                      # touch this file to stop the daemon at the next event
SAVED=/tmp/dashd.saved              # what the stock UI had on screen before our draw
IMG=/tmp/dashd.raw                  # 1280x1680 8-bit gray, the framebuffer layout
LOG=/tmp/dashd.log
WAKING=/tmp/dashd.waking            # epoch of our own full wake; the viewer plugin reads it too
PID=/tmp/dashd.pid
FBINK=/tmp/fbink                    # copy: /mnt/us is gone in USB drive mode

log() {
  [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 262144 ] && mv "$LOG" "$LOG.1"
  echo "$(date '+%F %T') $*" >> "$LOG"
}

prop() { lipc-get-prop com.lab126.powerd "$1" 2>/dev/null; }

restore() {
  lipc-set-prop com.lab126.blanket load screensaver 2>/dev/null
  log "blanket screensaver loaded again"
}

low_batt() {
  b=$(prop battLevel)
  [ -n "$b" ] && [ "$b" -le "$LOW_BATT" ] && [ "$(prop isCharging)" != 1 ]
}

is_night() {
  h=$(date +%H); h=${h#0}
  if [ "$NIGHT_START" -le "$NIGHT_END" ]; then
    [ "$h" -ge "$NIGHT_START" ] && [ "$h" -lt "$NIGHT_END" ]
  else
    [ "$h" -ge "$NIGHT_START" ] || [ "$h" -lt "$NIGHT_END" ]
  fi
}

# Doubles per failed refresh after the first, capped. At night one wake per MAX_INTERVAL is enough.
interval() {
  iv=$INTERVAL; n=1
  while [ $n -lt "$fail" ] && [ "$iv" -lt $MAX_INTERVAL ]; do iv=$((iv * 2)); n=$((n + 1)); done
  is_night && iv=$MAX_INTERVAL
  [ "$iv" -gt $MAX_INTERVAL ] && iv=$MAX_INTERVAL
  echo "$iv"
}

waking() {
  w=$(cat "$WAKING" 2>/dev/null) || return 1
  [ $(( $(date +%s) - ${w:-0} )) -lt 120 ] && return 0
  rm -f "$WAKING"; log "waking flag stale, removed"; return 1
}

fetch() {
  batt=$(prop battLevel)
  chg=$(prop isCharging)
  # +100 s: powerd suspends about 96 s after the request, and the alarm counts from the suspend.
  next=$(( $(date +%s) + INTERVAL + 100 ))
  if wget -q -T 15 -O "$IMG.new" "$SERVER/screen/sleep.raw?batt=$batt&charging=$chg&wifi=0&next=$next" &&
    [ "$(wc -c < "$IMG.new")" -eq 2150400 ]; then
    mv "$IMG.new" "$IMG"
    fail=0
    log "fetch: ok (batt $batt)"
  else
    rm -f "$IMG.new"
    log "fetch: failed, keeping last image"
    return 1
  fi
}

# The raw image is in the unrotated framebuffer layout.
fb_upright() {
  rot=$(cat /sys/class/graphics/fb0/rotate 2>/dev/null)
  [ "${rot:-0}" = 0 ] && return 0
  log "fb rotate $rot, framebuffer not touched"; return 1
}

# eips draws PNGs 3x wide on this panel and KOReader's FBInk has no image support,
# so write the bytes to the framebuffer and ask FBInk for a full (flashing) refresh.
draw() {
  fb_upright && [ -f "$1" ] && dd if="$1" of=/dev/fb0 bs=1280 count=1680 2>/dev/null && "$FBINK" -q -f -s
}

save() {
  rm -f "$SAVED"
  fb_upright && { dd if=/dev/fb0 of="$SAVED" bs=1280 count=1680 2>/dev/null || rm -f "$SAVED"; }
}

wait_state() {
  i=0
  while [ $i -lt 5 ]; do
    [ "$(prop state)" = "$1" ] && return 0
    sleep 1; i=$((i + 1))
  done
  return 1
}

# In the screen-saver state the connection manager (cmd) keeps the radio off, so this runs while active.
wait_wifi() {
  i=0
  while [ $i -lt "$1" ]; do
    [ "$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)" = CONNECTED ] && { log "wifi: connected after $i s"; return 0; }
    sleep 1; i=$((i + 1))
  done
  return 1
}

if [ -f "$PID" ] && grep -q dashd "/proc/$(cat "$PID")/cmdline" 2>/dev/null; then
  log "start: already running as $(cat "$PID"), exit"
  exit 0
fi
echo $$ > "$PID"
cp /mnt/us/koreader/fbink "$FBINK" 2>/dev/null || log "start: fbink copy failed"
log "start: server $SERVER, interval $INTERVAL s, night $NIGHT_START-$NIGHT_END"
rm -f "$STOP" "$WAKING"
lipc-set-prop com.lab126.blanket unload screensaver 2>/dev/null

while [ ! -f "$STOP" ]; do
  fail=0; low=0
  lipc-wait-event -m com.lab126.powerd goingToScreenSaver,readyToSuspend,wakeupFromSuspend,outOfScreenSaver |
  while read -r event rest; do
    [ -f "$STOP" ] && break
    if [ "$event" != outOfScreenSaver ]; then
      if low_batt; then
        # No alarm: the device sleeps until a button press, and the stock UI handles low battery.
        [ $low = 0 ] && { low=1; restore; log "low battery, refresh stopped"; }
        continue
      fi
      [ $low = 1 ] && { low=0; log "battery ok, refresh on again"; }
    fi
    case "$event" in
      goingToScreenSaver)
        lipc-set-prop com.lab126.blanket unload screensaver 2>/dev/null
        if waking; then
          # Back to sleep after our own refresh: keep the saved home screen, the image is already fresh.
          rm -f "$WAKING"
          sleep 2; draw "$IMG"
        else
          save
          # The stock UI may still be drawing its own sleep screen; draw after it.
          sleep 2; fetch; draw "$IMG"
        fi
        ;;
      readyToSuspend)
        # Sent again every few seconds; the last write wins over other powerd clients.
        iv=$(interval)
        lipc-set-prop com.lab126.powerd rtcWakeup "$iv" 2>/dev/null && [ "$rest" = 1 ] && log "rtc: $iv s"
        # On the last level, deferSuspend 1 may cut the ~36 s ready-to-suspend window (research 08).
        [ "$DEFER" = 1 ] && [ "$rest" = 1 ] && lipc-set-prop com.lab126.powerd deferSuspend 1 2>/dev/null && log "defer: 1"
        ;;
      wakeupFromSuspend)
        # After an RTC wake powerd stays in screenSaver; after a button wake it goes to active.
        sleep 2
        [ "$(prop state)" = screenSaver ] || { log "wake: button"; continue; }
        if is_night; then log "wake: rtc, night, no refresh"; continue; fi
        if [ "$fail" -ge 4 ] && [ $((fail % 4)) -ne 0 ]; then
          fail=$((fail + 1)); log "wake: rtc, backoff ($fail), no refresh"; continue
        fi
        # cmd keeps the radio off in the screen-saver state (seen every time on 5.18). Wake the device
        # fully (the same event as a power-button press), fetch, and send it back to sleep; the
        # goingToScreenSaver branch redraws.
        log "wake: rtc, waking fully"
        date +%s > "$WAKING"
        lipc-set-prop com.lab126.powerd powerButton 1
        if ! wait_state active; then
          rm -f "$WAKING"; log "wake: state $(prop state) after press, no refresh"; continue
        fi
        if wait_wifi 30; then fetch || fail=$((fail + 1)); else fail=$((fail + 1)); log "wake: no wifi"; fi
        # Not active: the user pressed power meanwhile. A second press would wake the device again.
        if [ "$(prop state)" = active ]; then
          lipc-set-prop com.lab126.powerd powerButton 1
        else
          log "wake: state $(prop state), no second press"
        fi
        ;;
      outOfScreenSaver)
        if waking; then log "wake: our own refresh, screen left as is"; continue; fi
        if pgrep -f reader.lua >/dev/null; then
          rm -f "$SAVED"; log "wake: KOReader repaints"; continue
        fi
        # We drew behind the stock UI's back, so it does not know to repaint. Put its screen back.
        if [ -f "$SAVED" ]; then draw "$SAVED"; rm -f "$SAVED"; fi
        log "wake: out of screensaver, screen restored"
        ;;
    esac
  done
  [ -f "$STOP" ] && break
  log "powerd event stream ended, restart in 5 s"
  sleep 5
done
restore
rm -f "$PID" "$WAKING"
log "exit: stop file"
