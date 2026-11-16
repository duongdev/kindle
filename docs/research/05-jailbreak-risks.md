# Jailbreak risks and recovery (KOA3, firmware 5.18.2.1.1)

Researched 2026-11-16. "Weak" = one forum post or one blog. "Inference" = our conclusion, no source states it.

## Bottom line

- The jailbreak itself is low risk. Per kindlemodding.org, bootloops come from low-level tweaks after the jailbreak, not from the jailbreak. ([kindle-recovery](https://kindlemodding.org/jailbreaking/faq/kindle-recovery.html))
- **No proven hard-brick recovery exists for KOA3.** USB serial-download and serial-console restore work only on older Kindles without secure boot (KT3 and older; 8th gen and older for partition restore). 10th gen has secure boot and a different partition layout. Inference: KOA3 has the same lock. ([MobileRead SDP tutorial](https://www.mobileread.com/forums/showthread.php?t=341361), [restoring](https://kindlemodding.org/jailbreaking/Legacy/backing-up/restoring.html), [KOA3 serial thread, weak](https://www.mobileread.com/forums/showthread.php?p=4373161))
- So every recovery path below needs the bootloader and kernel to still boot. **Rule: never write to boot, kernel, or raw eMMC partitions. Never `dd` to `mmcblk0`.**

## Current state of the device

- 5.18.2.1.1 (August 2026) is the latest KOA3 firmware found. The latest file on Amazon S3 for KOA3 is 5.18.2.1.1; newer names return 403 (inference from probing). Changelog mentions "hardened DRM", nothing about jailbreaks. ([blog, weak](https://blog.the-ebook-reader.com/2026/08/18/new-firmware-update-for-kindle-oasis-adds-hardened-drm/))
- Not patched: SpiderCat, Nosebleed, and Sanctuary all list KOA3 on this version. ([jailbreaks.json](https://kindlemodding.org/jailbreaks.json))
- Window can close: if Amazon pushes a newer firmware outside these ranges, you must wait for a new jailbreak. You cannot downgrade without a jailbreak. ([jailbreaking](https://kindlemodding.org/jailbreaking/index.html))

## Correction to our plan: use the modern flow

The current kindlemodding.org flow after SpiderCat or Nosebleed: remove `update*.bin` / `update.bin.tmp.partial` → delete filler → Installing Homebrew (scriptlets + KPM) → Jailbreaking Manager (Jobman) → KOReader (`;kpm install koreader`). "Updates have been automatically blocked for you." Hotfix, KUAL, MRPI are in the Legacy section; the homebrew page says KUAL is obsolete on the modern flow. Jobman gives SSH over USB and Wi-Fi, so USBNetwork is not needed. ([whats-next](https://kindlemodding.org/jailbreaking/whats-next/index.html), [installing-homebrew](https://kindlemodding.org/jailbreaking/whats-next/installing-homebrew.html), [jobman page](https://kindlemodding.org/jailbreaking/whats-next/jailbreaking-manager/))

## Risk register

| # | Phase | Risk | Severity | Mitigation | Source |
|---|---|---|---|---|---|
| R1 | Before | Amazon update installs before the jailbreak and closes the window | High | Airplane mode until the disk is full. Fill to 50–90 MB free. Check root for `update*.bin` before every step. | [prevent-auto-update](https://kindlemodding.org/jailbreaking/prevent-auto-update/) |
| R2 | Before | Update triggers: opening the Store, registering, any Wi-Fi, reboot while online | High | Do not open the Store. Turn on Wi-Fi only after filling, only for the jailbreak. | same |
| R3 | Before | Update arrives even with blocking in place (one report: KT5, July 2026) | Medium | Same as R1. Check root for `.bin` after every Wi-Fi session. | [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4598774) |
| R4 | Before | Full disk causes instability (old reports: reboots, stuck boot, small `/var/local`) | Low–Medium | Filler only during the jailbreak window. Do not add books while full. Delete filler right after. | [1](https://www.mobileread.com/forums/showthread.php?p=1937648), [2](https://www.mobileread.com/forums/showthread.php?p=2573405), [3](https://www.mobileread.com/forums/showthread.php?p=3120027) (all weak, old devices) |
| R5 | Before | Deleting filler in macOS Finder moves it to `.Trashes` on the Kindle; space stays used | Low | Delete with `rm -rf` in Terminal. | [Kindle-Filler-Disk](https://github.com/iiroak/Kindle-Filler-Disk) |
| R6 | During | Wrong method for model or firmware | Medium | Wizard confirmed 3 matches. SpiderCat shows `abort:no-firm` and stops if not compatible. | [SpiderCat](https://kindlemodding.org/jailbreaking/SpiderCat/) |
| R7 | During | Turning off Wi-Fi or power mid-run | Medium | Charge to 100% first. Keep Wi-Fi on until it finishes. "Application error" popups are expected; ignore them. | same |
| R8 | During | Files renamed by the browser ("(1)") or put in the wrong folder | Low | Check names and locations on the Mac before ejecting. | [installing-kual-mrpi](https://kindlemodding.org/jailbreaking/Legacy/post-jailbreak/installing-kual-mrpi/) |
| R9 | After | Factory reset while updates are blocked → "Update Failed" loop | High | Never factory reset without first unblocking updates (Jobman). Fix: sideload the official `.bin` (removes jailbreak). | [recovering-from-a-reset](https://kindlemodding.org/jailbreaking/faq/recovering-from-a-reset.html) |
| R10 | After | Renaming OTA binaries by hand or with several tools; tools lost both files | Medium | Use only the modern flow's blocking (Jobman). Never rename by hand. | [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4172083) |
| R11 | After | Wrong package ABI: soft-float (armel) package on hard-float firmware → "application could not be started" | Low | Install with `;kpm install koreader` (kindlehf). Never `kindlepw2` builds. | [KOReader wiki](https://github.com/koreader/koreader/wiki/Installation-on-Kindle-devices) |
| R12 | After | Untrusted packages can install malware or brick | High | Only kindlemodding KPM repo and KOReader official. Read scripts first. | [installing-homebrew](https://kindlemodding.org/jailbreaking/whats-next/installing-homebrew.html) |
| R13 | After | Jobman recovery is "highly experimental"; default SSH password `kindle` | Medium | Install it anyway (only safety net). Change the password. Test entering it once while healthy. | [kindle-recovery](https://kindlemodding.org/jailbreaking/faq/kindle-recovery.html) |
| R14 | Dev | Writing to rootfs (`mntroot rw`), bad upstart jobs → bootloop. Real cases: Scribe and PW5 needed a donor board. | **Critical** | No files in `/etc/upstart` and no rootfs edits. Run code from `/mnt/us` via scriptlet, KPM, or KOReader. If ever needed: file-guarded, fail fast, no respawn, `mntroot ro` right after. | [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4498170), [2012](https://www.mobileread.com/forums/showthread.php?p=1979049) |
| R15 | Dev | Pausing the UI wrongly leaves a soft-locked device | Medium | Copy KOReader's launcher (stops `awesome`, not `cvm`, on upstart firmware). Always resume in an exit trap. Recovery: hold power 40 s. | [koreader.sh](https://raw.githubusercontent.com/koreader/koreader/master/platform/kindle/koreader.sh) |
| R16 | Dev | Suspend through sysfs bypasses powerd; may not wake (one report with active SSH) | Medium | Prefer KOReader's powerd-based suspend. Test sysfs suspend with a short RTC alarm while plugged in. | [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=2785021), [device.lua](https://raw.githubusercontent.com/koreader/koreader/master/frontend/device/kindle/device.lua) |
| R17 | Dev | Filling `/var/local` breaks indexing and boot | Medium | Write logs and state to `/mnt/us` only. | weak, see R4 |
| R18 | Account | Amazon blacklists the device; deregistering deletes `documents/`; sideloaded books removed after long offline time | Low | No account bans reported. Back up `documents/` before and after. Do not tell Amazon support about mods. | [jailbreak-faq](https://kindlemodding.org/jailbreaking/Legacy/jailbreak-faq.html) |
| R19 | Account | Warranty "probably" void | Low | Accept. | same |
| R20 | Undo | Unjailbreaking lets Amazon push firmware with no jailbreak | Medium | Only unjailbreak if you accept that. | [unjailbreaking](https://kindlemodding.org/jailbreaking/faq/unjailbreaking.html) |

## Owner reports for the three methods on Oasis 10th gen

No brick, bootloop, or forced reset is reported for any of them on an Oasis. Bad outcomes in reports come from a factory reset in the wrong order (R9). Reddit was not searchable (gap).

| Method | Released | Oasis reports | Notes |
|---|---|---|---|
| **SpiderCat** | 2026-09-01 (site dates are day first) | 2–3 successes, one on **5.18.2.1.1** (our exact firmware) | After success, `;kpm` / `;log` stopped responding; a second run hung at "executing" ~30 min. A forced restart fixed it and KOReader installed. Two owners, same symptom (verified). ([WinterBreak#65](https://github.com/KindleModding/WinterBreak/issues/65), [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4608085)) |
| Nosebleed | 2026-03-02 | 1 success on 5.18.2 (after re-sideloading firmware) | "Application Error" on first try then retry worked (other models). ([MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4604892), [thread](https://www.mobileread.com/forums/showthread.php?t=372352)) |
| Sanctuary | 2026-06-30 | 1 partial failure on 5.18.2 with German UI | Reporter says switch UI to English first. Silent failure bug fixed 2026-09-28. Needs a plain-http third-party server. ([#195](https://github.com/KindleModding/kindlemodding.github.io/issues/195), [PR #231](https://github.com/KindleModding/kindlemodding.github.io/pull/231)) |

**Choice: SpiderCat.** Wizard first pick, success on our exact firmware, known hiccup has a known fix. Nosebleed is the fallback.

Extra risks from reports:

| # | Risk | Mitigation | Source |
|---|---|---|---|
| R21 | Post-jailbreak commands stop responding / run hangs at "executing" | Do not re-run the jailbreak. Hold power 40 s, then retry. | [WinterBreak#65](https://github.com/KindleModding/WinterBreak/issues/65) |
| R22 | Non-English UI breaks some installs | Set the Kindle language to English before starting. | [#195](https://github.com/KindleModding/kindlemodding.github.io/issues/195) |
| R23 | Two package installs at once | One `;kpm` command at a time; wait for it to finish. | [cyancity guide, weak](https://github.com/cyancity/kindle-gadget/blob/main/docs/opensource/JAILBREAK.zh.md) |
| R24 | Mac cannot write or delete over USB after jailbreak (one open report, model unknown) | If it happens, delete the filler over SSH (Jobman) or with a forced restart and retry. Filler must stay until the jailbreak is done. | [SpiderCat#1, weak](https://github.com/KindleModding/SpiderCat/issues/1) |

## Reddit findings (r/kindlejailbreak, read 2026-11-16)

Read through the Arctic Shift archive (keyless reddit-mcp-server); scores and very recent comments may be missing. All single threads, so weak unless noted.

- SpiderCat's author (u/sparklerfish) answered "Yup" to "Will this work on a KOA3 5.18.2.1.1?" in the release thread. ([release thread](https://reddit.com/r/kindlejailbreak/comments/1w4no8k/))
- Another KOA3 owner on 5.18.2.1.1 was pointed to SpiderCat; AdBreak worked for a commenter after enabling ads (not our case). ([thread](https://reddit.com/r/kindlejailbreak/comments/1x4s0k5/))
- Amazon firmware 5.19.6 patches SpiderCat; it stops at "waiting" there. ([thread](https://reddit.com/r/kindlejailbreak/comments/1x59pvt/))
- An Oasis 10th gen in a boot loop (stuck on tree logo, USB connects for a split second). Second-hand unit, no jailbreak mentioned, no fix found. Confirms there is no DIY recovery once the device cannot boot. ([r/kindle](https://reddit.com/r/kindle/comments/1we9huz/))

| # | Risk | Mitigation | Source |
|---|---|---|---|
| R25 | Deleting the wrong `.bin` after the jailbreak. One user deleted the `libkh` binaries that SpiderCat installs on purpose. | Delete only files named `update*.bin` / `update.bin.tmp.partial` in the root. Touch nothing else. | [release thread](https://reddit.com/r/kindlejailbreak/comments/1w4no8k/) |
| R26 | Library and launchers vanish after the jailbreak (5.18.6, after days in Airplane mode). Author says the indexer failed on a corrupted reader database. Fixed by an `emergency.sh` that deletes `/var/local/cc.db` and `dcm.db`, then `;kpm install koreader` again. | Know the fix. **Never run an `emergency.sh` from a stranger or a file-sharing link** (the one in the thread was hosted on a random file site). Write our own, reviewed, if needed. | [thread](https://reddit.com/r/kindlejailbreak/comments/1xqxavn/) |
| R27 | Higher battery drain after the jailbreak. Causes reported: EPUBs inside `documents/` (the Kindle indexer keeps failing on them) and the Amazon reader running behind KOReader. | Keep books in a folder outside `documents/`. Start KOReader without the framework (no-framework launcher scriptlet). Disable unused plugins. Directly relevant to our battery goal. | [thread](https://reddit.com/r/kindlejailbreak/comments/1xd60fn/) |
| R28 | USB drive mode does not work while KOReader runs. | Exit to the Kindle UI before plugging in, or use SSH (Jobman) for deploys. | [thread](https://reddit.com/r/kindlejailbreak/comments/1w6s00s/) (several replies agree) |
| R29 | Crash core dumps of `KPPMainAppV2` (~200 MB each) collect in `/mnt/us` and fill the storage. | Check the root for `*.core` files now and then; the author says they are safe to delete. | [thread](https://reddit.com/r/kindlejailbreak/comments/1wcbs0o/) |
| R30 | `Filler.sh` cannot be made executable on the FAT32 drive (`chmod` has no effect). | Run it with `sh Filler.sh`, or create filler files on the Mac with `dd`. | [thread](https://reddit.com/r/kindlejailbreak/comments/1x9revo/) |

## Recovery ladder (needs a booting kernel)

1. Forced restart: hold power 40 s. Fixes hangs and soft locks.
2. Jobman Recovery: install right after the jailbreak. Enter with a `JOBMAN_RECOVERY` file over USB, a tap in the 10 s boot window, or 3+ reboots less than 180 s apart. Gives logs, file repair, update sideload, SSH over USB. README lists "5.18.2.1.1 KOA3" as tested (verified). ([jobman](https://github.com/KindleTweaks/jobman))
3. Hotfix hook (legacy, only if installed): on boot it runs `/mnt/us/emergency.sh` if present. ([hotfix](https://kindlemodding.org/kindle-hacking/hotfix.html))
4. Reflash official firmware: copy `update_kindle_*.bin` to the root, then Settings > Update Your Kindle. Same version or newer is accepted. Removes the jailbreak. ([unjailbreaking](https://kindlemodding.org/jailbreaking/faq/unjailbreaking.html))
5. Factory reset (`freset` in search, or menu). Only after unblocking updates (R9).
6. Downgrade: likely blocked on 5.18.x. Treat as unavailable. ([downgrading](https://kindlemodding.org/firmware-and-flashing/downgrading/))
7. Hard brick: no DIY path. Amazon replacement or dead device.

Keep a copy of the official firmware on the Mac: `https://s3.amazonaws.com/firmwaredownloads/update_kindle_all_new_oasis_v2_5.18.2.1.1.bin` (359,518,038 bytes, Last-Modified 2026-08-11, verified by HEAD request).

## Backups

- Before root: only USB storage (`documents/`, `screenshots/`, `My Clippings.txt`, `fonts/`). Purchased books stay in the Amazon account, but USB download of purchases was removed in February 2025 ([blog, weak](https://blog.the-ebook-reader.com/2025/03/19/is-amazon-trying-to-lock-down-kindles-or-is-something-else-at-play/)).
- After root: a read-only `dd` image of `mmcblk0` over SSH is useful to extract files later, not to reflash (inference; partition restore is not possible on 10th gen).

## Not found

- Official Amazon confirmation of 5.18.2.1.1 (Amazon page returned 503).
- 2025–2026 reports of full-disk problems on current firmware.
- How the modern flow blocks updates internally.
- A Kindle-specific guide for RTC `wakealarm`.
