#!/bin/sh
# Copy a plugin from this repo to the Kindle over SSH (Wi-Fi), then swap it in place.
# Usage: sh scripts/deploy.sh [plugin]   (default: dashboard)
#        KINDLE_HOST=192.168.15.244 sh scripts/deploy.sh   (over USB SSH)
# Restart KOReader on the Kindle afterwards to load the new code.
set -e

NAME=${1:-dashboard}
HOST=${KINDLE_HOST:-192.168.1.24}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/plugins/$NAME.koplugin"
DEST=/mnt/us/koreader/plugins
SSH_OPTS="-i $HOME/.ssh/kindle_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 -o LogLevel=ERROR"

[ -d "$SRC" ] || { echo "no such plugin: $SRC"; exit 1; }

# shellcheck disable=SC2086
ssh $SSH_OPTS "root@$HOST" "rm -rf '$DEST/$NAME.koplugin.new'"
# shellcheck disable=SC2086
scp -q -r $SSH_OPTS "$SRC" "root@$HOST:$DEST/$NAME.koplugin.new"
# shellcheck disable=SC2086
ssh $SSH_OPTS "root@$HOST" "cd '$DEST' && rm -rf '$NAME.koplugin' && mv '$NAME.koplugin.new' '$NAME.koplugin' && ls '$NAME.koplugin'"
echo "deployed $NAME to $HOST:$DEST/$NAME.koplugin"
