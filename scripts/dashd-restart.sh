#!/bin/sh
# Install kindle/dashd/dashd.sh on the Kindle and (re)start it from /tmp. Usage: INTERVAL=300 sh scripts/dashd-restart.sh
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOST=${KINDLE_HOST:-192.168.1.24}
k() { ssh -i "$HOME/.ssh/kindle_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o LogLevel=ERROR "root@$HOST" "$@"; }
k 'mkdir -p /mnt/us/dashd; cat > /mnt/us/dashd/dashd.sh' < "$ROOT/kindle/dashd/dashd.sh"
# Anchored pattern: an unanchored one also matches this ssh command's own shell and kills it.
k "echo \"state \$(lipc-get-prop com.lab126.powerd state)\"; cat /tmp/dashd.log 2>/dev/null; pkill -f '^sh /tmp/dashd.sh' || true; sleep 1
cp /mnt/us/dashd/dashd.sh /tmp/dashd.sh; rm -f /tmp/dashd.log
(INTERVAL=${INTERVAL:-1800} setsid sh /tmp/dashd.sh </dev/null >/dev/null 2>&1 &); sleep 1; cat /tmp/dashd.log"
