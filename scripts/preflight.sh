#!/bin/sh
# Read-only checks before each jailbreak step. Never writes to the Kindle.
# Usage: sh scripts/preflight.sh <prepare|filled|jailbreak|cleaned>
#   prepare   step 0-1: device facts, no update files, local copies ready
#   filled    step 2:   free space is 50-90 MB
#   jailbreak step 3:   filled + SpiderCat book in documents/
#   cleaned   step 4:   no update files, filler gone

PHASE=${1:-prepare}
K=${KINDLE:-/Volumes/Kindle}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
FW="$ROOT/private/firmware/update_kindle_all_new_oasis_v2_5.18.2.1.1.bin"
FW_SIZE=359518038
BOOK="$ROOT/private/downloads/spidercat/spidercat.azw3"
WANT_VERSION="5.18.2.1.1"
FREE_MIN=50
FREE_MAX=90

fail=0
ok()   { echo "  ok    $1"; }
warn() { echo "  WARN  $1"; }
bad()  { echo "  STOP  $1"; fail=1; }

case "$PHASE" in prepare|filled|jailbreak|cleaned) ;; *) echo "unknown phase: $PHASE"; exit 2 ;; esac
echo "preflight: $PHASE"

if [ ! -d "$K" ]; then bad "Kindle not mounted at $K"; echo "STOP"; exit 1; fi
ok "Kindle mounted at $K"

fs=$(diskutil info "$K" 2>/dev/null | sed -n 's/.*File System Personality: *//p')
case "$fs" in *FAT32*) ok "file system $fs" ;; *) bad "unexpected file system: ${fs:-unknown}" ;; esac

v=$(cat "$K/system/version.txt" 2>/dev/null)
case "$v" in *" $WANT_VERSION "*) ok "firmware $WANT_VERSION" ;; *) bad "firmware is not $WANT_VERSION: ${v:-unreadable}" ;; esac

updates=$(find "$K" -maxdepth 1 \( -iname 'update*.bin' -o -iname 'update.bin.tmp.partial' \) 2>/dev/null)
if [ -n "$updates" ]; then bad "update files in root (an update was downloaded): $updates"; else ok "no update files in root"; fi

cores=$(find "$K" -maxdepth 1 -name '*.core' 2>/dev/null | wc -l | tr -d ' ')
[ "$cores" = 0 ] && ok "no crash dumps in root" || warn "$cores crash dump file(s) in root (*.core)"

free_mb=$(df -m "$K" | awk 'NR==2 { print $4 }')
echo "  info  free space: ${free_mb} MB"

if [ "$PHASE" = prepare ]; then
  if [ -f "$FW" ] && [ "$(stat -f %z "$FW")" = "$FW_SIZE" ]; then ok "official firmware copy on Mac"; else bad "official firmware copy missing or wrong size: $FW"; fi
  ls -d "$ROOT"/private/backup-* >/dev/null 2>&1 && ok "backup folder exists" || bad "no backup in private/backup-*"
  [ -f "$BOOK" ] && ok "SpiderCat book downloaded" || bad "SpiderCat book missing: $BOOK"
fi

if [ "$PHASE" = filled ] || [ "$PHASE" = jailbreak ]; then
  if [ "$free_mb" -ge "$FREE_MIN" ] && [ "$free_mb" -le "$FREE_MAX" ]; then ok "free space within $FREE_MIN-$FREE_MAX MB"
  else bad "free space ${free_mb} MB is outside $FREE_MIN-$FREE_MAX MB"; fi
fi

if [ "$PHASE" = jailbreak ]; then
  on_kindle="$K/documents/spidercat.azw3"
  if [ ! -f "$on_kindle" ]; then bad "spidercat.azw3 not in documents/"
  elif [ "$(shasum -a 256 < "$on_kindle")" = "$(shasum -a 256 < "$BOOK")" ]; then ok "spidercat.azw3 in documents/, matches download"
  else bad "spidercat.azw3 on Kindle differs from download"; fi
  odd=$(find "$K/documents" -maxdepth 1 -iname 'spidercat*' ! -name 'spidercat.azw3' 2>/dev/null)
  [ -z "$odd" ] || warn "extra SpiderCat-like files (renamed copies?): $odd"
fi

if [ "$PHASE" = cleaned ]; then
  [ -d "$K/fill_disk" ] && bad "filler folder fill_disk/ still present" || ok "filler removed"
  [ -d "$K/.Trashes" ] && [ -n "$(ls -A "$K/.Trashes" 2>/dev/null)" ] && warn ".Trashes is not empty (Finder delete keeps space used)"
fi

echo
[ "$fail" = 0 ] && echo "GO" || { echo "STOP"; exit 1; }
