# Dashboard while the stock Kindle home runs

Researched 2026-11-17 by reading source code and forum threads. Nothing was run on the device. "Weak" = one forum post. "Inference" = our conclusion, no source states it.

Question: can the owner use the stock Kindle home most of the time and still get the dashboard, or must KOReader stay open?

## Short answer

Yes, with two parts:

1. A small shell daemon draws the dashboard as the **sleep screen** while the stock UI runs. It is not interactive, and it refreshes only on RTC wakes (about every 20 to 60 min, not every minute).
2. A **scriptlet** on the stock home starts KOReader straight into the interactive dashboard. "Exit" in KOReader returns to the stock home.

The daemon can start at boot from a `/mnt/us` file, through the boot hook that the jailbreak already installed. No new rootfs edit is needed.

## 1. Dashboard as the sleep screen

### Who draws the stock sleep screen

- The stock sleep screen is drawn by the `blanket` process. Its modules are `screensaver` (ad-free) or `ad_screensaver` (Special Offers). KOReader reads `com.lab126.blanket load` to tell them apart. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua), `isSpecialOffers`; [blanket lipc](https://kindlemodding.org/kindle-apps-and-services/com.lab126.blanket.html))
- The module can be turned off and on at run time with lipc, without a file change: `lipc-set-prop com.lab126.blanket unload screensaver` and `... load screensaver`. KOReader does this when it stops the framework, and loads it again on exit. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua), `frameworkStopped`, `KindleTouch:exit`)
- On Special Offers devices KOReader resumes `awesome` (the window manager) at sleep, "to let the native system handle screensavers". Inference: blanket's screen needs `awesome` running, so it does show while the stock UI runs. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua), `intoScreenSaver`)

So the answer to "does the stock screensaver draw over ours?": yes, if the `screensaver` module stays loaded. Two ways to stop that:

- **Unload the module** while the daemon runs, load it again when the daemon stops. Clean, run time only, no rootfs write. If the daemon dies, the sleep screen shows the last UI page; nothing breaks (inference).
- **Draw after blanket**: wait for `goingToScreenSaver`, sleep a short time, then draw. This is what the online screensaver does (it calls `eips -f -g` when powerd status says "Screen Saver"). It races with blanket. ([update.sh](https://github.com/Kuhno92/onlinescreensaverPW2/blob/master/bin/update.sh))

Ours is ad-free, and `jb.sh` also deletes `/var/local/adunits` and disables ad units in `appreg.db`. So the module is `screensaver`. ([jb.sh](https://kindlemodding.org/jb.sh), stage `06_disable_ads.sh`)

If "Show cover" (Settings > Device Options, ad-free only, firmware 5.13.4+) is on, the stock sleep screen is the book cover. Inference: blanket's `screensaver` module draws it too, so unloading covers both. ([the-ebook-reader blog, weak](https://blog.the-ebook-reader.com/2021/04/16/book-covers-now-available-on-kindle-lock-screens/))

### Powerd events and RTC wake

- Events from `com.lab126.powerd`: `goingToScreenSaver <src>`, `outOfScreenSaver <src>`, `readyToSuspend <delay>`, `suspending`, `wakeupFromSuspend`, `resuming`. Sources: 1 = button wake, 2 = button sleep, 4 = cover (hall) sleep, 6 = cover wake. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua), `POWERD_EVENT_SOURCES`; [MobileRead event logger, 5.17, weak](https://www.mobileread.com/forums/showthread.php?p=4507607))
- RTC wake through powerd: in the `readyToSuspend` state, set `lipc-set-prop -i com.lab126.powerd rtcWakeup <seconds>`. The online screensaver loop does this with `lipc-wait-event -s <t> com.lab126.powerd readyToSuspend,wakeupFromSuspend,resuming`. KOReader uses the same property. ([utils.sh](https://github.com/Kuhno92/onlinescreensaverPW2/blob/master/bin/utils.sh) `wait_for`; [powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua))
- Our own device run (2026-11-17): the delay counts from the real suspend, not from now. Sleep starts about 96 s after the request (60 s `t2_timeout` in SCREEN SAVER, then about 36 s in READY TO SUSPEND). After an RTC wake powerd goes back to SCREEN SAVER, so each wake likely costs that window again. Hibernation starts after 3600 s of suspend. (`.scratch/v1-dashboard/issues/06-battery-loop-spike.md`)
- Consequence: a live minute clock on the sleep screen is not possible through powerd. Show "updated HH:MM" instead. Keep the wake interval under 3600 s to avoid hibernation.
- Direct suspend (`echo mem > /sys/power/state` + `/sys/class/rtc/.../wakealarm`) skips the 96 s, but it bypasses powerd while the stock UI and powerd run. Risk R16 in `05-jailbreak-risks.md`. Not for this option.

### Prior art

| Project | Works with stock UI? | Start | Fit for 5.18 + our rules |
|---|---|---|---|
| Online Screensaver (peterson; PW2 fork by Kuhno92) | Yes. Replaces the screensaver file and redraws with `eips` at sleep; powerd `rtcWakeup` loop | KUAL; `enable.sh` copies `onlinescreensaver.conf` to `/etc/upstart` with `mntroot rw` | Loop logic yes. Install no (rootfs write, KUAL). ([repo](https://github.com/Kuhno92/onlinescreensaverPW2), [enable.sh](https://github.com/Kuhno92/onlinescreensaverPW2/blob/master/bin/enable.sh), [original thread](https://www.mobileread.com/forums/showthread.php?t=236104)) |
| kindle-dash (pascalw) | No. `init()` runs `/etc/init.d/framework stop` | Manual or KUAL | No. Tested only on Kindle 4 NT. ([dash.sh](https://github.com/pascalw/kindle-dash/blob/main/src/dash.sh), [README](https://github.com/pascalw/kindle-dash)) |
| re-kindle | No. `killall -STOP cvm` | Upstart job in `/etc/upstart` | No (rootfs). See `03-prior-art.md`. |
| kdashboard | No. Takes the screen and `EVIOCGRAB` input; keeps the device awake | Own launcher | No. See `03-prior-art.md`. |
| ScreenSaverManager (madebyKir, 5.17.1) | Yes, static images | KUAL; copies PNGs into `/usr/share/blanket/screensaver` and an upstart file into `/etc/upstart` | No (rootfs). ([install scripts](https://github.com/madebyKir/ScreenSaverManager/tree/main/bin)) |
| ScreenSavers hack / linkss (NiLuJe) | — | MRPI | No. NiLuJe: not supported on firmware with native custom screensaver support. ([MobileRead, NiLuJe 2023-12-19](https://www.mobileread.com/forums/showthread.php?p=4388717)) |
| hass-kindle-screensaver (sibbl) | Server side only: renders a PNG every minute for the online screensaver | Docker | Idea only: render the PNG on the LAN, the Kindle just fetches and draws. ([README](https://github.com/sibbl/hass-kindle-screensaver)) |

No prior art fits "stock UI + no rootfs write + 5.16+". The daemon is new code, but small: the online screensaver's wait loop, plus FBInk, plus the blanket unload.

### Drawing

- The jailbreak installs a full FBInk build at `/var/local/kmc/bin/fbink` (copy at `/mnt/us/libkh/bin/fbink`). Its help text has `-g file=...` image support. (Checked in the `jb.sh` payload, `kindlehf/bin/fbink`; [jb.sh](https://kindlemodding.org/jb.sh) stage `04_setup_kmc.sh`)
- The daemon cannot reuse the Lua widget, because KOReader is not running. Two choices: render a PNG on a LAN host (sibbl style) and draw it with `fbink -g`, or draw text and boxes with FBInk on the device (re-kindle style, `03-prior-art.md`). Inference: the LAN PNG is less code on the device but needs a host that is always on.

## 2. Start the daemon at boot without KUAL or rootfs edits

What the modern flow already installed:

- **`jb.sh` boot hook (installed by SpiderCat).** `jb.sh` v2.6.0 runs `patch_system.sh`, which copies `kmc.conf` to `/etc/upstart/kmc.conf` (immutable). The job runs `start on framework_ready`. In `pre-start` it checks `/mnt/us/emergency.sh`; if the file exists it runs `/bin/sh /mnt/us/emergency.sh` and returns. ([jb.sh](https://kindlemodding.org/jb.sh) stages `07_patch_system.sh` → `08_install_kmc_upstart.sh`; same job in the [Universal Hotfix repo](https://github.com/KindleModding/Hotfix/blob/rewrite-lite/src/kmc/hotfix/kmc.conf), derived from NiLuJe's bridge job; [hotfix page](https://kindlemodding.org/kindle-hacking/hotfix.html))
- In v2.6.0 the emergency branch skips nothing important: after it, the job only writes a log line. The older hotfix job skipped KMC permission fixes. ([jb.sh](https://kindlemodding.org/jb.sh) payload `system_patches/kmc.conf`)
- `/mnt/us/emergency.sh` is also run by the `.run_emergency` launcher that `jb.sh` registers in `appreg.db`. It is a shared hook. ([jb.sh](https://kindlemodding.org/jb.sh) payload `sql/appreg_register_emergency.sql`)
- **Jobman**: its only boot job is `jobman_recovery.conf` (optional, `start on mounted_userstore and display_ready and loaded_touch`). It offers recovery, and a one-shot KOReader start when the flag `/var/tmp/JOBMAN_START_KOREADER` is set from the Jobman UI. It has no user autostart. ([jobman_recovery.conf](https://github.com/KindleTweaks/jobman/blob/main/companion/dist/jobman/jobman_recovery.conf))
- **KPM**: package hooks are only `install.sh`, `launch.sh`, `uninstall.sh`. No services, no boot hook. ([KPM README](https://github.com/KindleModding/KPM))
- **Scriptlets**: `.sh` files in `/mnt/us/documents` run on tap only. Header flags: `# Name:`, `# Author:`, `# Icon:`, `# UseHooks` (`on_install`, `on_remove`, `on_run`), `# DontUseFBInk`. No boot hook. ([scriptlets](https://kindlemodding.org/kindle-dev/scriptlets.html))

So the only `/mnt/us` boot hook is `emergency.sh`. Rules to use it safely (inference unless cited):

- Keep `emergency.sh` tiny: check a kill-switch file (for example `/mnt/us/dashd/DISABLE`), start the daemon with `setsid ... &`, and exit at once. `pre-start` runs it in line; a script that hangs can stall the `kmc` job and maybe the boot.
- In the daemon, sleep 60 to 90 s before the first draw (re-kindle waits 90 s for the same reason: time to recover). ([03-prior-art.md](03-prior-art.md))
- Copy the daemon to `/var/tmp` or `/tmp` and run it from there. USB drive mode unmounts `/mnt/us`. Jobman does the same (`cp -r /mnt/us/jobman/* /tmp/jobman/`) before it runs. ([jobman_recovery.conf](https://github.com/KindleTweaks/jobman/blob/main/companion/dist/jobman/jobman_recovery.conf))
- No respawn, no writes outside `/mnt/us` and `/tmp`, logs to `/mnt/us`.
- Undo: delete `/mnt/us/emergency.sh` over USB or SSH, or create the kill-switch file. If Jobman recovery is on, it runs before `framework_ready`, so its file tools still work if the hook goes wrong.
- Our own rule in `docs/procedures/jailbreak.md` forbids running an `emergency.sh` from a stranger. This one is our own, reviewed code, but it runs at every boot: write a procedure first (project convention).

Not checked on the device: that `/etc/upstart/kmc.conf` exists, matches v2.6.0, and that `/var/local/kmc/version` = `v2.6.0`. Read these over SSH before relying on the hook.

## 3. Start the interactive dashboard from the stock home

- Our plugin already opens the dashboard at start when `DASHBOARD_AUTOSTART` is set (`plugins/dashboard.koplugin/main.lua`). `koreader.sh` re-runs itself from `/var/tmp` and starts `reader.lua` with the same environment, so the variable gets through (inference from [koreader.sh](https://github.com/koreader/koreader/blob/master/platform/kindle/koreader.sh)).
- A scriptlet `/mnt/us/documents/dashboard.sh` with `# Name: Dashboard`, `# Icon: ...`, `# DontUseFBInk` that runs `DASHBOARD_AUTOSTART=1 /mnt/us/koreader/koreader.sh --asap`. The KOReader "start with" setting is not needed.
- Detach from the library launcher first, as Jobman does: `setsid sh <self> --detached &`, then `sleep 2`. Jobman's comment: otherwise the launcher "can bring the home screen back over" the app. ([jobman.sh](https://github.com/KindleTweaks/jobman/blob/main/companion/dist/documents/jobman.sh))
- `--asap` skips the start delays in `koreader.sh`. Without `--framework_stop` the framework keeps running; on upstart firmware `koreader.sh` disables pillow and SIGSTOPs `awesome`, not `cvm`. ([koreader.sh](https://github.com/koreader/koreader/blob/master/platform/kindle/koreader.sh))
- Return to the stock home: KOReader "Exit". `koreader.sh` then resumes `awesome` and pillow and restores the screen it saved at start. A "Home" button in the dashboard can call `UIManager:quit()` for the same result (inference).
- Time from tap to dashboard: no source gives a number. Parts: launcher detach (2 s, Jobman), `koreader.sh` start, KOReader start, one `nextTick`. Measure on the device.

## 4. Touch while the dashboard is the sleep screen

- Not confirmed by a primary source. The only wake sources KOReader knows on Kindle are the power button and the cover hall sensor (sources 1, 2, 4, 6). ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua))
- In suspend, Wi-Fi SSH does not answer on our device (issue 06). Inference: touch does not wake the device from suspend; only the power button, the cover, RTC, and maybe USB plug-in do.
- Unknown: whether touch events reach `/dev/input` during the 60 s SCREEN SAVER window before suspend, and whether the Oasis page-turn buttons wake it. Not worth building on; treat the sleep screen as display only.

## 5. Conflicts

| Conflict | What happens | Rule |
|---|---|---|
| KOReader and the daemon both draw | When KOReader runs it SIGSTOPs `awesome`, so blanket does not show, and KOReader draws its own sleep screen (ad-free device). The daemon would draw over KOReader. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua) `intoScreenSaver`) | Daemon does nothing while `pidof reader.lua` finds KOReader (inference). |
| Both set `rtcWakeup` | One alarm in powerd; the last writer wins (inference). | One owner at a time: the daemon pauses while KOReader runs. |
| Blanket unloaded and daemon dies | Sleep screen shows the last UI page. | Load the module again in the daemon's exit trap and on its kill switch. |
| USB drive mode | KOReader SIGSTOPs `volumd`, so drive mode does not work while it runs ([koreader.sh](https://github.com/koreader/koreader/blob/master/platform/kindle/koreader.sh); R28). The daemon does not stop `volumd`, but `/mnt/us` goes away during drive mode. | Run from `/tmp`; skip a cycle if `/mnt/us` is not mounted. |
| OTA block | Jobman blocks OTA by renaming `/usr/bin/otaupd` and `/usr/bin/otav3` to `.bck` with `chattr +i` ([main.rs](https://github.com/KindleTweaks/jobman/blob/main/src/main.rs) `block_ota`). `jb.sh` also stops and renames them. The daemon turns Wi-Fi on; with the block in place this is the same risk as normal Wi-Fi use. | Do not touch the OTA files. Check the root for `update*.bin` now and then (R1–R3). |
| Wi-Fi off | `com.lab126.cmd wirelessEnable 0` is airplane mode and changes the stock UI state (issue 06). | Use `com.lab126.wifid enable 0/1` only, and only if Wi-Fi was off before. |

## Options compared

| Option | Battery | Interactivity | Effort | Risk |
|---|---|---|---|---|
| A. KOReader stays open (today) | Best control, but KOReader's powerd path costs about 96 s awake per wake (issue 06) | Full touch, live after power-button wake | None more | Low. Stock home only after "Exit" |
| B. Sleep-screen daemon only (stock UI runs) | Same powerd cost per wake; hourly or 20 min wakes are fine, no minute clock | None. Display only | Medium: shell loop, renderer, boot hook | Medium: boot hook in `emergency.sh`; low if it is tiny and has a kill switch |
| C. Scriptlet launcher only | No sleep-screen dashboard; stock sleep screen | Full, on tap | Small: one scriptlet | Low. Runs only on tap |
| **D. B + C** | As B | Glance on the sleep screen, touch after one tap on the home icon | Medium | Medium, same as B |
| E. Direct suspend daemon with the stock UI | Best (short wakes) | None | Medium | High: bypasses powerd under a running framework (R16) |

## Recommendation

Option D, in this order:

1. **Scriptlet launcher now** (option C). Small, runs only on tap, uses the existing `DASHBOARD_AUTOSTART`. Measure tap-to-dashboard time.
2. **Read-only checks over SSH**: `/etc/upstart/kmc.conf` content, `/var/local/kmc/version`, `lipc-get-prop com.lab126.blanket load`, and whether `/etc/upstart/jobman_recovery.conf` exists.
3. **Spike the sleep-screen daemon by hand** before any boot hook: start it from SSH, unload blanket `screensaver`, draw with FBInk on `goingToScreenSaver`, set `rtcWakeup` on `readyToSuspend`, wake every 20 to 30 min. Confirm that blanket does not redraw and that the module loads again on stop.
4. **Only then** add `/mnt/us/emergency.sh` (tiny, kill switch, `setsid`, 60 s delay), with a procedure in `docs/procedures/`.

KOReader does not need to stay open. The cost: the sleep screen is a glance view that refreshes on a schedule, and touch needs one tap on the home icon.

## Not found

- A number for tap-to-dashboard time from a scriptlet.
- Whether blanket draws again on the SUSPENDED → SCREEN SAVER step after an RTC wake (unloading the module makes this moot).
- Whether touch reaches `/dev/input` during the SCREEN SAVER window on KOA3.
- How `framework_ready` is emitted, so whether a slow `emergency.sh` can block the framework.
