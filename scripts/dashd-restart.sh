#!/bin/sh
# Install kindle/dashd/dashd.sh on the Kindle and (re)start it from /tmp.
# Usage: INTERVAL=300 NIGHT_START=0 NIGHT_END=6 sh scripts/dashd-restart.sh
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOST=${KINDLE_HOST:-192.168.1.24}
k() { ssh -i "$HOME/.ssh/kindle_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o LogLevel=ERROR "root@$HOST" "$@"; }
k 'mkdir -p /mnt/us/dashd; cat > /mnt/us/dashd/dashd.sh' < "$ROOT/kindle/dashd/dashd.sh"
# Kill only our own daemon and its children: KOReader and the system run their own powerd
# lipc-wait-event listeners, so a pattern match on lipc-wait-event would kill theirs too.
# Anchored pattern: an unanchored one also matches this ssh command's own shell.
k "echo \"state \$(lipc-get-prop com.lab126.powerd state)\"; cat /tmp/dashd.log 2>/dev/null
for p in \$(pgrep -f '^sh /tmp/dashd.sh'); do pkill -P \$p; kill \$p; done 2>/dev/null; sleep 1
rm -f /tmp/dashd.pid /tmp/dashd.waking /tmp/dashd.log /tmp/dashd.log.1; cp /mnt/us/dashd/dashd.sh /tmp/dashd.sh
(DEFER=${DEFER:-0} INTERVAL=${INTERVAL:-1800} NIGHT_START=${NIGHT_START:-0} NIGHT_END=${NIGHT_END:-6} setsid sh /tmp/dashd.sh </dev/null >/dev/null 2>&1 &); sleep 1; cat /tmp/dashd.log"
