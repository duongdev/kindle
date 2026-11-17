#!/bin/sh
# Sleep-screen daemon (issue 08, ADR 0002). Draws the server's sleep PNG when the stock UI goes to sleep,
# and asks powerd to wake the device every INTERVAL seconds to draw a fresh one.
# Run by hand from SSH: see docs/procedures/sleep-screen-daemon.md.
# It also handles sleep while KOReader (the dashboard viewer) is open: KOReader's sleep screen is set to
# "Leave screen as-is" with no message, so KOReader draws nothing at sleep and sets no wake alarm of its own.
# Start it from a /tmp copy: USB drive mode unmounts /mnt/us.

SERVER=${SERVER:-http://192.168.1.102:10060}
INTERVAL=${INTERVAL:-1800}          # below 3600 s so powerd does not hibernate; 90 for quick tests
DIR=/mnt/us/dashd
STOP=$DIR/STOP                      # touch this file to stop the daemon at the next event
SAVED=/tmp/dashd.saved              # what the stock UI had on screen before our draw
IMG=/tmp/dashd.raw                  # 1280x1680 8-bit gray, the framebuffer layout
LOG=/tmp/dashd.log
WAKING=/tmp/dashd.waking            # set while we hold the device awake for a refresh

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

restore() {
  lipc-set-prop com.lab126.blanket load screensaver 2>/dev/null
  log "stop: blanket screensaver loaded again"
}

fetch() {
  batt=$(lipc-get-prop com.lab126.powerd battLevel 2>/dev/null)
  chg=$(lipc-get-prop com.lab126.powerd isCharging 2>/dev/null)
  next=$(( $(date +%s) + INTERVAL ))
  if wget -q -T 15 -O "$IMG.new" "$SERVER/screen/sleep.raw?batt=$batt&charging=$chg&wifi=0&next=$next" &&
    [ "$(wc -c < "$IMG.new")" -eq 2150400 ]; then
    mv "$IMG.new" "$IMG"
    log "fetch: ok (batt $batt)"
  else
    rm -f "$IMG.new"
    log "fetch: failed, keeping last image"
  fi
}

# eips draws PNGs 3x wide on this panel and KOReader's FBInk has no image support,
# so write the bytes to the framebuffer and ask FBInk for a full (flashing) refresh.
show() {
  [ -f "$IMG" ] && dd if="$IMG" of=/dev/fb0 bs=1280 count=1680 2>/dev/null && /mnt/us/koreader/fbink -q -f -s
}

wait_wifi() {
  # In the screen-saver state the connection manager (cmd) holds the radio until powerd goes active.
  # Ask it first (KOReader's call), then ask wifid directly, which skips cmd.
  lipc-set-prop com.lab126.cmd ensureConnection "wifi${ESSID:+:$ESSID}" 2>/dev/null
  i=0
  while [ $i -lt "${1:-30}" ]; do
    state=$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)
    [ "$state" = "CONNECTED" ] && { log "wifi: connected after ${i} s"; return 0; }
    if [ $i -eq 3 ] && [ -n "$ESSID" ]; then
      lipc-set-prop com.lab126.wifid cmConnect "$ESSID" 2>/dev/null
      log "wifi: $state, sent cmConnect"
    fi
    [ $((i % 10)) -eq 0 ] && log "wifi: $state at ${i} s"
    sleep 1; i=$((i + 1))
  done
  return 1
}

ESSID=$(echo '{}' | lipc-hash-prop com.lab126.wifid currentEssid 2>/dev/null | sed -n 's/^[[:space:]]*essid = "\(.*\)"$/\1/p' | head -1)
log "start: server $SERVER, interval $INTERVAL s, wifi ${ESSID:-unknown}"
rm -f "$STOP" "$WAKING"
lipc-set-prop com.lab126.blanket unload screensaver 2>/dev/null

lipc-wait-event -m com.lab126.powerd goingToScreenSaver,readyToSuspend,wakeupFromSuspend,outOfScreenSaver |
while read -r event rest; do
  if [ -f "$STOP" ]; then restore; exit 0; fi
  case "$event" in
    goingToScreenSaver)
      lipc-set-prop com.lab126.blanket unload screensaver 2>/dev/null
      if [ -f "$WAKING" ]; then
        # Back to sleep after our own refresh: keep the saved home screen, the image is already fresh.
        rm -f "$WAKING"
        sleep 2; show
      else
        dd if=/dev/fb0 of="$SAVED" bs=1280 count=1680 2>/dev/null
        # The stock UI may still be drawing its own sleep screen; draw after it.
        sleep 2; fetch; show
      fi
      ;;
    readyToSuspend)
      # Sent again every few seconds; the last write wins over other powerd clients.
      lipc-set-prop com.lab126.powerd rtcWakeup "$INTERVAL" 2>/dev/null && log "rtc: $INTERVAL s (level $rest)"
      ;;
    wakeupFromSuspend)
      # After an RTC wake powerd stays in screenSaver; after a button wake it goes to active.
      sleep 2
      if [ "$(lipc-get-prop com.lab126.powerd state 2>/dev/null)" = "screenSaver" ]; then
        log "wake: rtc"
        if [ "$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)" = "CONNECTED" ]; then
          fetch; show
        else
          # cmd keeps the radio off in the screen-saver state (seen every time on 5.18; ensureConnection and
          # cmConnect do not change it). Wake the device fully (the same event as a power-button press),
          # fetch, and send it back to sleep; the goingToScreenSaver branch redraws.
          log "wake: no wifi in screensaver, waking fully"
          touch "$WAKING"
          lipc-set-prop com.lab126.powerd powerButton 1
          wait_wifi 30 || log "wake: still no wifi"
          fetch
          lipc-set-prop com.lab126.powerd powerButton 1
        fi
      else
        log "wake: button"
      fi
      ;;
    outOfScreenSaver)
      if [ -f "$WAKING" ]; then log "wake: our own refresh, screen left as is"; continue; fi
      # We drew behind the stock UI's back, so it does not know to repaint. Put its screen back.
      if [ -f "$SAVED" ]; then
        dd if="$SAVED" of=/dev/fb0 bs=1280 count=1680 2>/dev/null && /mnt/us/koreader/fbink -q -f -s
        rm -f "$SAVED"
      fi
      log "wake: out of screensaver, screen restored"
      ;;
  esac
done
log "exit: powerd event stream ended"
