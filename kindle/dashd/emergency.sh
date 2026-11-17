#!/bin/sh
# Boot hook (issue 09). SpiderCat's /etc/upstart/kmc.conf runs /mnt/us/emergency.sh as root on every boot,
# at framework_ready. Keep it tiny and return at once: start the sleep-screen daemon detached, after a delay.
# Kill switch: create /mnt/us/dashd/DISABLE (or delete /mnt/us/emergency.sh) and reboot.
[ -f /mnt/us/dashd/DISABLE ] && exit 0
[ -f /mnt/us/dashd/dashd.sh ] || exit 0
setsid sh -c '
  sleep 60
  [ -f /mnt/us/dashd/DISABLE ] && exit 0
  cp /mnt/us/dashd/dashd.sh /tmp/dashd.sh && INTERVAL=1800 exec sh /tmp/dashd.sh
' </dev/null >/dev/null 2>&1 &
exit 0
