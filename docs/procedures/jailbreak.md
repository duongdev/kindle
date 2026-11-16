# Procedure: jailbreak KOA3 with SpiderCat

Status: **draft, not yet run.** Read [05-jailbreak-risks.md](../research/05-jailbreak-risks.md) first. Re-check the kindlemodding.org pages on the day; they change often.

Fallback method: Nosebleed. Do not try Sanctuary on this device.

## Stop conditions

Stop and ask for help (KindleModding Discord) if any of these happen. Do not improvise.

- Any `update*.bin` or `update.bin.tmp.partial` file appears in the Kindle root before the jailbreak.
- Device Info shows a firmware other than 5.18.2.1.1.
- SpiderCat shows `abort:no-firm`.
- The device does not boot to the home screen after a 40 s forced restart.

## 0. Prepare (Mac only, device stays in Airplane mode)

Local copies live in `private/` (gitignored).

- [x] Official firmware: `private/firmware/update_kindle_all_new_oasis_v2_5.18.2.1.1.bin`, 359,518,038 bytes (matches Amazon), SHA-256 in the `.sha256` file next to it. Done 2026-11-16.
- [x] Backup of the USB drive: `private/backup-2026-11-16/` (563 files, 134 MB). Done 2026-11-16.
- [x] SpiderCat book: `private/downloads/spidercat/spidercat.azw3` from `https://kindlemodding.org/spidercat/spidercat.azw3`, 484,178 bytes, server Last-Modified 2026-11-08, SHA-256 in `.sha256`. Done 2026-11-16. Download it again on the day if the site has a newer version.
- [x] Filler: no third-party `Filler.sh`. Step 2 uses macOS `mkfile` (R30 avoided).
- [x] `sh scripts/preflight.sh prepare` prints GO.

## 1. Device setup

- [ ] Charge to 100%. Keep the charger near.
- [ ] Airplane mode ON. Confirm.
- [ ] Language: English (R22).
- [ ] Settings > Device Options > Device Info: firmware 5.18.2.1.1. Note the free space.
- [ ] Root of the USB drive: no `update*.bin`, no `update.bin.tmp.partial`.

## 2. Block updates with filler (R1–R5)

- [x] Fill to about 70 MB free (takes several minutes over USB). Done 2026-11-16: 61 x 100 MB + 1, 70 MB free.

```sh
K=/Volumes/Kindle; mkdir -p "$K/fill_disk"
free() { df -m "$K" | awk 'NR==2 { print $4 }'; }
i=0; while [ "$(free)" -gt 170 ]; do i=$((i+1)); mkfile 100m "$K/fill_disk/f$i"; done
mkfile "$(( $(free) - 70 ))m" "$K/fill_disk/last"; free
```

- [x] `sh scripts/preflight.sh filled` prints GO.
- [ ] Eject. Check free space in Device Info: 50–90 MB.
- [ ] Do not open the Store. Do not add books.

## 3. Jailbreak

- [x] `cp private/downloads/spidercat/spidercat.azw3 /Volumes/Kindle/documents/`. Done 2026-11-16 (server file unchanged since 2026-11-08).
- [x] `sh scripts/preflight.sh jailbreak` prints GO (69 MB free). Eject.
- [ ] Turn Wi-Fi ON (Airplane mode off). Connect.
- [ ] Open the SpiderCat book. Ignore "Application error" popups. Wait for scrolling text, then "Restarting Kindle".
- [x] After reboot: check for `JAILBROKEN.txt` / the jailbroken message. Done 2026-11-16: home screen OK, `documents/JAILBROKEN.txt` says jb.sh v2.6.0, `libkh/` and `privesc_marker.txt` added, firmware still 5.18.2.1.1.
- [ ] If `;kpm` or `;log` do not respond, or it hangs at "executing": **do not re-run**. Hold power 40 s, then retry (R21).
- [ ] Airplane mode ON again.

## 4. Clean up

- [x] Connect USB. Delete `update*.bin` / `update.bin.tmp.partial` from the root **first**. Delete no other `.bin` file; SpiderCat installs some on purpose (R25).
- [x] Then delete the filler with `rm -rf /Volumes/Kindle/fill_disk` (not Finder, R5). Run this yourself in Terminal: Claude Code's safety check blocks deleting a top-level folder of a drive.
- [x] `sh scripts/preflight.sh cleaned` prints GO (6,233 MB free). Done 2026-11-16.

## 5. Post-jailbreak (modern flow)

Follow kindlemodding.org "What's Next" in order. One `;kpm` command at a time (R23).

Needs Wi-Fi. Updates are blocked by the jailbreak ("Stopping OTA" / "Renaming OTA" in its log), but the filler is gone, so check the root for update files after this Wi-Fi session (`sh scripts/preflight.sh cleaned`).

Type each command in the home screen search bar and press Enter. Wait until the home screen returns before the next one.

- [x] Wi-Fi on.
- [x] `;kpm update` (text shows at the top, then the home screen returns).
- [x] `;kpm install jobman`. A new Jobman scriptlet icon appears (may take a moment). 2026-11-16: `documents/jobman.sh` installed, but no icon in the library yet (likely needs one normal restart). `;kpm launch jobman` works.
- [x] Open Jobman (tap the icon, or `;kpm launch jobman`). Confirm updates are blocked. Jobman v1.2.2: Update Blocking says "OTA updates are currently disabled".
- [x] SSH: key-only login over USB, password login off (R13). See docs/procedures/ssh.md.
- [ ] Jobman: Install Recovery (decide first; experimental).
- [ ] Test once while healthy: enter Jobman Recovery with a `JOBMAN_RECOVERY` file, then exit.
- [x] `;kpm install koreader`. A KOReader icon appears; launch with a tap or `;kpm launch koreader`. KOReader v2026.07.1, armhf build, launched and exited cleanly.
- [x] Wi-Fi off (Airplane mode on). Plug in, run `sh scripts/preflight.sh cleaned`. GO, no update files.
- [ ] Keep books in a folder outside `documents/`. Use the no-framework KOReader launcher (R27).
- [ ] Optional: read-only `dd` image of `mmcblk0` over SSH to the Mac (for extracting files later, not for reflashing).

## Never do

- Factory reset while updates are blocked (R9). Unblock in Jobman first.
- Write to rootfs, `/etc/upstart`, boot, or kernel partitions (R14). Never `dd` to `mmcblk0`.
- Rename OTA binaries by hand (R10).
- Install packages from outside the kindlemodding KPM repo or KOReader official (R12).
- Run an `emergency.sh` or any script from a stranger or a file-sharing link (R26).
