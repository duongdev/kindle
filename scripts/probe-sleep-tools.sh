#!/bin/sh
# Read-only probe for issue 11. Prints what the sleep-screen daemon needs; changes nothing.
HOST=${KINDLE_HOST:-192.168.1.24}
ssh -i "$HOME/.ssh/kindle_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 -o LogLevel=ERROR "root@$HOST" '
for t in wget curl lipc-wait-event lipc-set-prop pgrep setsid; do printf "%s: " $t; command -v $t || echo missing; done
printf "fbink: "; ls /mnt/us/koreader/fbink 2>/dev/null || echo missing
/mnt/us/koreader/fbink -q -e 2>/dev/null | head -3
echo "blanket: $(lipc-get-prop com.lab126.blanket load 2>&1)"
echo "powerd: $(lipc-get-prop com.lab126.powerd state) batt=$(lipc-get-prop com.lab126.powerd battLevel)"
echo "kmc.conf: $(ls /etc/upstart/kmc.conf 2>&1)"; cat /var/local/kmc/version 2>/dev/null
echo "jobman recovery: $(ls /etc/upstart/jobman_recovery.conf 2>&1)"
echo "emergency.sh: $(ls /mnt/us/emergency.sh 2>&1)"
echo "server: $(wget -q -T 5 -O /dev/null http://192.168.1.102:10060/healthz && echo reachable || echo unreachable)"
'
