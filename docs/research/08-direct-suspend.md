# Direct suspend vs. the powerd path (KOA3, firmware 5.18.2.1.1)

Researched 2026-11-17 by reading source code, project notes and forum threads. Nothing was run on the device. "Weak" = one forum post, one blog, or one hobby project. "Inference" = our conclusion, no source states it. "Unverified" = must be confirmed on our device.

## Bottom line

- **Direct suspend (`wakealarm` + `echo mem`) is proven on other Kindles, but the only report on our exact setup failed.** On a KOA3 with 5.18.2 and kernel 4.1.15-lab126, the framework running and `preventScreenSaver 1`, `echo mem` suspended the device. Then neither the rtc0 alarm nor a short power-button press woke it in 90 minutes. A long power hold (forced restart) recovered it, and `/mnt/us` was intact. ([kindle-gadget DESIGN.md, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md))
- **The powerd path cannot give a 1-minute cycle.** After an RTC wake, powerd goes to SCREEN SAVER and waits the t2 timer (60 s) again before READY TO SUSPEND. No lipc property to shorten t2 was found. ([rtc-wifi-validation, PW3 5.16.2.1.1, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md), [koreader-ppw3 powerd notes, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md))
- No report found of a hard brick or a boot loop from direct suspend. The bad outcomes are "sleeps with no wake" and "silent stop". A forced restart or a USB plug fixed each one. Data loss was limited to logs that were not synced. (Sources in "What breaks" below.)

## 1. Direct suspend while powerd runs

### Who does it, and on which devices

| Project | Device, firmware | What it does around powerd | Result |
|---|---|---|---|
| re-kindle | KT2, 5.12.2.2 | `preventScreenSaver 1` while awake, `killall -STOP cvm`, writes `+N` to `rtc*/wakealarm`, `sync`, `echo mem` | Works, about 10%/week ([03-prior-art](03-prior-art.md), [repo](https://github.com/abdenourgnx/re-kindle)) |
| kindle-wall-display | PW5 Signature, **5.19.2** | Stops the framework (`initctl stop framework` or `lab126_gui`), **no** `preventScreenSaver` on the suspend path, Wi-Fi off first, read back the alarm | Works for weeks, with failures listed below ([calendar.sh](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh), [README](https://github.com/jstriblet/kindle-wall-display), weak) |
| trmnl-kindle (TRMNL) | 11th gen, 5.19.2 seen | Stops framework, `preventScreenSaver 1`, `echo 0` then `+N` to `rtc1` (or `rtc0`), `echo mem`, falls back to `sleep` on error | Shipped by a vendor; no failure data ([TRMNL.sh](https://github.com/usetrmnl/trmnl-kindle/blob/main/zip_example/TRMNL.sh)) |
| kindle-dash | older PWs (mxc_rtc) | `/etc/init.d/framework stop`, `preventScreenSaver 1`, writes `mxc_rtc.0/wakeup_enable` | Older devices only. KOA3 has no `mxc_rtc` node ([dash.sh](https://github.com/pascalw/kindle-dash/blob/main/src/dash.sh), [kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)) |
| onlinescreensaver (PW2) | PW2 | Waits for powerd `readyToSuspend`/`resuming` events, then `wakealarm` + `echo mem`, `deferSuspend 1` | Works on PW2 ([utils.sh](https://github.com/Kuhno92/onlinescreensaverPW2/blob/main/bin/utils.sh)) |
| KT3 weather display | KT3 | Stops framework, `cmd`, `phd`, `volumd`, `tmd`; **keeps powerd** ("battery state doesnt work" without it) | Works ([weatherscript.sh](https://github.com/nicoh88/kindle-kt3_weatherdisplay_battery-optimized/blob/master/Kindle/weatherscript.sh)) |
| kindle-weather-stand-alone | older | `/etc/init.d/powerd stop`, then `rtc1` + `echo mem` | Works on its device ([start.sh](https://github.com/x-magic/kindle-weather-stand-alone/blob/master/extensions/weather-stand/bin/start.sh)) |
| **kindle-gadget** | **KOA3, 5.18.2, 4.1.15-lab126** | Framework **running**, `preventScreenSaver 1`, `rtc0/wakealarm` written (rc=0), `echo mem` | **Failed**: no RTC wake, short power press did not wake, forced restart needed ([DESIGN.md, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)) |

The same KOA3 report confirms our RTC layout: rtc0/rtc1 = max77796 PMIC, rtc2 = SNVS; rtc0 `wakealarm` can be written, read back and cleared while awake; `/sys/power/state` = `freeze standby mem`; busybox `rtcwake` exists. ([kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md))

Inference: powerd itself programs rtc0 (our log shows `max77796-rtc: set_wakealarm <epoch>`), and that alarm does wake the device. So the rtc0 hardware works. The KOA3 failure is most likely in what powerd does before or around suspend (wake sources, PMIC setup, hibernation timer), or in the framework still running. Nobody has tested KOA3 with the framework stopped.

### What breaks

- **Suspend refused (EBUSY).** A held Wi-Fi wakelock ("WLAN timeout") makes the kernel refuse `echo mem`. Fix: turn Wi-Fi off before suspend. ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh))
- **`preventScreenSaver 1` vs. suspend.** One project saw every suspend refused while it was set and stopped setting it on the suspend path ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh)). Other projects set it and suspend fine ([TRMNL.sh](https://github.com/usetrmnl/trmnl-kindle/blob/main/zip_example/TRMNL.sh), [re-kindle](https://github.com/abdenourgnx/re-kindle)). On a PW3 it also blocks the `powerButton` sleep that KOReader uses ([koreader-ppw3, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md)).
- **powerd suspends on its own with no alarm set.** If the loop dies or waits with no hold, powerd idle-suspends the device and nothing is armed. Seen as 4 h, 19 h and 35 h "dark screen" outages. One ended with a power-button hold, one with a USB plug. Fix: arm a safety alarm at the top of every cycle and before every awake wait. ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh))
- **Missed alarm.** About 1 wake in 50, the rtc0 alarm did not fire on a PW5. They mirror the alarm to rtc1 as a backup. ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh))
- **"Alarm set" that is not set.** A cleared `wakealarm` reads back `0`, so a non-empty check passes. They now require a number in the future. ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh)) The kernel also **silently disables** the alarm (write still succeeds) when the value is not in the future, and returns EBUSY for a new value while an alarm is already on. Always `echo 0` first. ([rtc-sysfs.c v4.1](https://github.com/torvalds/linux/blob/v4.1/drivers/rtc/rtc-sysfs.c))
- **Power button after resume.** On KOA3, the power button did not wake from a direct suspend ([kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)). On a PW2 (5.8.9.2), a short press after a direct suspend did not make the script return until a full power-on ([MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=2786992)). An older report: one device stayed dead after `echo mem` until reboot, with SSH active ([MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=2785021)).
- **Wi-Fi.** After a suspend that powerd did not run, `wifid enable 1` is dropped as a duplicate and Wi-Fi stays `NA`. Only the powerd resume events (`notReadyToSuspend`, `resuming`) bring it back. ([rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md)) Direct-suspend projects cycle `wirelessEnable 0/1` around every sleep instead ([calendar.sh](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh), [TRMNL.sh](https://github.com/usetrmnl/trmnl-kindle/blob/main/zip_example/TRMNL.sh)).
- **Screen (EPDC).** Suspend during a refresh leaves a half-drawn screen. Wait for the refresh to finish (`fbink -w`) before suspend. ([re-kindle](https://github.com/abdenourgnx/re-kindle))
- **Hibernation (falcon).** KOA3 has `CONFIG_FALCON=y` and no kernel `CONFIG_HIBERNATION` ([koa3.config](https://github.com/katadelos/eink-emulator/blob/main/kindle-kexec/configs/koa3.config)). powerd sets the S2H timer itself ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua) reads `hibernate.s2h.rtc.secs`). Inference: a direct suspend does not set the S2H timer, so the device does not hibernate. That is not a problem for short sleeps. What powerd does on resume when its timer state is stale is unknown.
- **Watchdog.** KOA3 builds `CONFIG_IMX2_WDT=y` ([koa3.config](https://github.com/katadelos/eink-emulator/blob/main/kindle-kexec/configs/koa3.config)). Who feeds it, and whether a direct suspend changes that, is unknown. No report of a watchdog reset from direct suspend was found.
- **Frontlight, battery accounting.** No source covers these for direct suspend. powerd owns the frontlight through lipc, and KOReader restores it after resume ([powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua)). Battery level still comes from powerd (`battLevel`), so keep powerd running ([weatherscript.sh](https://github.com/nicoh88/kindle-kt3_weatherdisplay_battery-optimized/blob/master/Kindle/weatherscript.sh)).
- **USB.** While USB power is on, powerd stays in SCREEN SAVER and does not reach READY TO SUSPEND ([rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md)). The t2 timer does not run while charging ([koreader-ppw3, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md)). Test sleep timing on battery only.

### How projects keep powerd from fighting

- `preventScreenSaver 1`: holds off the idle screensaver, but it is "advisory": powerd still suspended a PW5 seconds after it was set ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh)).
- Stop the framework (`stop lab126_gui` on upstart firmware; KOReader does this with `--framework_stop`) ([koreader.sh](https://github.com/koreader/koreader/blob/master/platform/kindle/koreader.sh)). powerd keeps running.
- Stop powerd (`/etc/init.d/powerd stop`) ([start.sh](https://github.com/x-magic/kindle-weather-stand-alone/blob/master/extensions/weather-stand/bin/start.sh)). This loses battery level and frontlight control. Amazon's own `updatewait` stops powerd only for a firmware update ([updatewait](https://github.com/libxzr/sysdump_amazon_rex/blob/master/rootfs.img.gz/fwo_rootfs.img/usr/sbin/updatewait)).
- `deferSuspend` during READY TO SUSPEND ([utils.sh](https://github.com/Kuhno92/onlinescreensaverPW2/blob/main/bin/utils.sh)).
- SIGSTOP of `cvm` (re-kindle) or `awesome` (KOReader on upstart). Neither stops powerd.

## 2. Faster path through powerd

### States and timers

- Order: ACTIVE → (t1, 600 s idle, or `powerButton 1`) → SCREEN SAVER → (t2, 60 s) → READY TO SUSPEND → (grace) → SUSPENDED. RTC wake → SCREEN SAVER, and the cycle repeats from t2. ([KOReader PR #9269, yparitcher](https://github.com/koreader/koreader/pull/9269), [rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md))
- `kdb get system/daemon/powerd/...` on a PW3 5.14.2: `t1_timeout` 600, `t2_timeout` 60, `r2s_grace_timeout` 5. ([koreader-ppw3, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md))
- READY TO SUSPEND is longer than 5 s on new firmware. `readyToSuspend` carries a countdown level (`10, 8, 7, 7, 6, 2, 1` on PW3 5.16.2.1.1), and system clients (for example `phd`) register their own RTC alarms at each level. ([rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md)) Scribe 5.19.5: first `readyToSuspend` 60.0 s after the screensaver, last one 10.2 s before the kernel suspend ([StayInk POWER.md, weak](https://github.com/hujunhan/StayInk/blob/main/docs/research/POWER.md)). This matches our 36 s.

### Properties

All on `com.lab126.powerd`. KindleModding lists them with "TODO" descriptions ([com.lab126.powerd](https://kindlemodding.org/kindle-apps-and-services/com.lab126.powerd.html)). What is known:

| Property | Type | What it does | Source |
|---|---|---|---|
| `powerButton` | w Int | Same as a press. KOReader sleeps with it. | [powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua) |
| `rtcWakeup` | w Int | Seconds from now. Accepted only in READY TO SUSPEND. Must be set **after the last level-1 `readyToSuspend` (+2 s)**, or later clients override it. A 45 s request was logged `rtc_set_ignored`. | [powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua), [rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md), [KindleCron](https://github.com/lennardollesch/KindleCron) |
| `rtcWakeup2` | w Str | **No documentation found anywhere.** Format unknown. | [com.lab126.powerd](https://kindlemodding.org/kindle-apps-and-services/com.lab126.powerd.html) |
| `deferSuspend` | w Int | Settable only in READY TO SUSPEND (else `lipcErrNoSuchProperty`). Touch: sets the remaining time in that state (`1000` → 999 s left). Resets after reboot. Other reports disagree: "only extends it" (PW3) and "sends the device back to active" (KindleCron). `powerd_test -d <value>` sets the same thing. | [MobileRead, sirpoot, weak](https://www.mobileread.com/forums/showthread.php?p=2610501), [rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md), [KindleCron](https://github.com/lennardollesch/KindleCron), [MobileRead, powerd_test help, weak](https://www.mobileread.com/forums/showthread.php?p=3681635) |
| `suspendGrace` | w Int | A **minimum wait** before suspend, in seconds ("Suspend grace is set. Waiting for %d secs"). Amazon's `updatewait` sets 20 to delay suspend; a PW3 project renews 120 to stay awake in SCREEN SAVER. It lengthens, it does not shorten. | [updatewait](https://github.com/libxzr/sysdump_amazon_rex/blob/master/rootfs.img.gz/fwo_rootfs.img/usr/sbin/updatewait), [koreader-ppw3, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md), [scheduled-sleep-updates, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/scheduled-sleep-updates.zh-CN.md) |
| `abortSuspend` | w Int | In READY TO SUSPEND: back to SCREEN SAVER with a full t2 timer. powerd sends the normal resume events, and Wi-Fi reconnects in about 1 s. | [MobileRead K4, weak](https://www.mobileread.com/forums/showthread.php?p=4092247), [rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md) |
| `wakeUp` | w Int | `wakeUp 1` in SCREEN SAVER → ACTIVE. Does nothing once suspended. | [MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4507724), [MobileRead, sirpoot, weak](https://www.mobileread.com/forums/showthread.php?p=2610501) |
| `touchScreenSaverTimeout` | w Int | Resets t1 (any value). Fails in SCREEN SAVER. | [powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua) |
| `preventScreenSaver` | rw Int | Blocks the t1 screensaver, and on PW3 also `powerButton` sleep. | [koreader-ppw3, weak](https://github.com/luutuankiet/koreader-ppw3/blob/main/docs/reference/kindle-powerd.md) |
| `t1` / `screenSaverTimeout` | — | No such properties exist in the lists. | [com.lab126.powerd](https://kindlemodding.org/kindle-apps-and-services/com.lab126.powerd.html) |

So:

- **t2 (60 s in SCREEN SAVER) has no lipc knob.** Only `kdb` changes it. Inference: every powerd-path wake costs at least 60 s + the READY TO SUSPEND window.
- **The READY TO SUSPEND window might shrink** with `deferSuspend 1` written after our `rtcWakeup`, if the Touch behavior (value = time left) still holds. Unverified on KOA3, and the reports conflict. It also cuts off system clients that register alarms late (Amazon maintenance wakes) ([rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md)). Best case: about 60 s + 1 s per wake instead of about 96 s.

### `kdb set system/daemon/powerd/t2_timeout`

- Old reports need `mntroot rw` before `kdb set ...t1_timeout` and `mntroot ro` after, so `kdb set` writes to the rootfs ([MobileRead K4, weak](https://www.mobileread.com/forums/showthread.php?p=4092247)). Older firmware stored the value as a file under `/etc/kdb.src/.../powerd/t1_timeout` and restarted powerd ([MobileRead, 2011](https://www.mobileread.com/forums/showthread.php?p=1893970)). So it is persistent across reboots (inference).
- On a K4, `t2_timeout` changes gave "a fixed amount of time" whatever the value ([MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=4092247)).
- Risk: it is a rootfs write (our rootfs is 95% full, [04-device-facts](04-device-facts.md)), and rootfs edits are the known bootloop cause (R14 in [05-jailbreak-risks](05-jailbreak-risks.md)). A bad t1/t2 value could also cause a sleep loop that survives a reboot. **Do not do it.**

## 3. KOReader on Kindle, with and without the framework

- `koreader.sh --framework_stop` sets `STOP_FRAMEWORK=yes` and runs `stop lab126_gui` (upstart). Without it, KOReader SIGSTOPs `awesome`. powerd is never stopped. ([koreader.sh](https://github.com/koreader/koreader/blob/master/platform/kindle/koreader.sh))
- With the framework stopped, KOReader registers a fake `com.lab126.kaf frameworkStarted = 1` and unloads the blanket `splash` and `screensaver` modules, so powerd still works. ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua))
- Suspend is always through powerd: `powerButton 1` by lipc, or `powerd_test -p` only if there is no lipc handle. KOReader reacts to the powerd events `goingToScreenSaver`, `readyToSuspend`, `wakeupFromSuspend`, `outOfScreenSaver`. There is **no** sysfs suspend path on Kindle (unlike Kobo). ([powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua), [device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua))
- `WakeupMgr` on Kindle uses `MockRTC`. It never touches `/sys/class/rtc`. It stores the epoch and sends `rtcWakeup <alarm - now>` on every `readyToSuspend` event. ([mockrtc.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/mockrtc.lua), [powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua)) Because it re-sends on every event, the last write is after the last level, which matches the "set it last" rule above (inference).
- After a wake, KOReader checks the powerd state 15 s later. `screenSaver` or `suspended` means scheduled wake; it accepts a match within 30 s, because "the alarm may fire 10 seconds early". ([powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua), [mockrtc.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/mockrtc.lua))
- Conclusion: "no framework" mode does not give KOReader control of suspend. A direct suspend from a plugin would be our own code (`os.execute` of the sysfs writes).

## 4. RTC accuracy, minimum delay, resume latency

- Resolution is 1 s. The sysfs `wakealarm` takes epoch seconds, `+N` (relative) or `+=N` (add to the current alarm) ([Documentation/rtc.txt v4.1](https://github.com/torvalds/linux/blob/v4.1/Documentation/rtc.txt)).
- An alarm at or before "now": the sysfs write disables the alarm and returns success ([rtc-sysfs.c v4.1](https://github.com/torvalds/linux/blob/v4.1/drivers/rtc/rtc-sysfs.c)); the ioctl path returns `-ETIME` ([interface.c v4.1](https://github.com/torvalds/linux/blob/v4.1/drivers/rtc/interface.c)). The kernel notes a race when the alarm is 1 s away. Use at least +2 s.
- The max77796 driver is Lab126-only; its source was not found online. Minimum delay and how the PMIC rounds are unknown. The KOA3 kernel sets the system clock from rtc0 (`CONFIG_RTC_HCTOSYS_DEVICE="rtc0"`) ([koa3.config](https://github.com/katadelos/eink-emulator/blob/main/kindle-kexec/configs/koa3.config)).
- powerd path, PW3 5.16.2.1.1: `rtcWakeup 180` set at READY TO SUSPEND; powerd logged `secs = 162` at the real suspend; hardware resumed at the alarm second; powerd sent the wake event 2 s later, state `screenSaver`, reason `POWERD_WAKEUP_REASON_RTC`. ([rtc-wifi-validation, weak](https://github.com/Iranb/bjtu-kindle-dashboard/blob/main/docs/rtc-wifi-validation.zh-CN.md)) KOReader says the alarm can fire up to 10 s early ([powerd.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/powerd.lua)).
- Inference: for an exact :00 redraw, wake 3–5 s early and wait for :00 in software. Do not trust the alarm second.
- Resume to first screen update: no measurement found for any Kindle. Measure it (timestamp in the `wakeupFromSuspend` handler vs. after `fbink -w`).

## 5. Recovery

- **Short power press**: wakes a powerd suspend. Did not wake a KOA3 direct suspend ([kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)).
- **USB plug**: woke a PW5 from a 35 h direct-suspend coma ([calendar.sh, weak](https://github.com/jstriblet/kindle-wall-display/blob/main/kindle/trmnlcal/bin/calendar.sh)); "the kernel wakes on USB events" ([MobileRead, knc1, weak](https://www.mobileread.com/forums/showthread.php?p=3681635)). Not tested on KOA3.
- **Forced restart**: hold the power button for 40 s, until the screen goes blank and the device restarts. Content is kept. ([Amazon help](https://digprjsurvey.amazon.com/csad/help/node/G9WDGDTCSDQMSU7Z)) This recovered the KOA3 direct-suspend failure ([kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)).
- **State that survives a reboot**:
  - Files on `/mnt/us` (scripts, logs, flags) ([kindle-gadget, weak](https://github.com/wenlo-luo/kindle-gadget/blob/main/daemon/DESIGN.md)). **An autostart that runs the loop again is the real trap**: a loop that starts at boot and suspends at once leaves no window to stop it.
  - `kdb` / rootfs changes (section 2).
  - lipc properties do **not** survive: `deferSuspend` resets after reboot ([MobileRead, weak](https://www.mobileread.com/forums/showthread.php?p=2610501)). Processes, `preventScreenSaver` and SIGSTOPs are gone after a restart (inference).
  - The RTC alarm register is in the PMIC, which stays powered. Inference: an old alarm can wake the device once after a reboot. That is harmless.
  - Falcon hibernation: whether a 40 s restart resumes a hibernation image or cold boots is unknown. Our tests sleep less than 3600 s, so powerd never starts hibernation.

## Risks

1. **No wake after a direct suspend (KOA3).** Seen once on our exact model and firmware. Mitigation: first test only at a desk, with a stopwatch, ready to hold power 40 s. Cost is time, not a brick.
2. **Loop restarts after recovery.** Mitigation: no autostart during tests. Later: autostart only after a 90 s delay, and a kill-switch file on `/mnt/us` checked before every suspend (it can be created over USB mass storage).
3. **Alarm not armed.** Clear with `0`, write `+N`, read back, require a value at least 2 s in the future, else do not suspend. Arm a safety alarm before any long wait.
4. **powerd suspends under us with no alarm.** Keep a safety alarm armed whenever our code is waiting.
5. **Wi-Fi lost after a direct suspend.** Turn Wi-Fi off before suspend and on after. Expect wifid to need `wirelessEnable` cycling.
6. **Half-drawn screen.** Wait for `fbink -w` (or KOReader's refresh done) before suspend.
7. **Tight suspend/wake loop.** Count failed or short sleeps; after 3, stop suspending and stay awake.
8. **`deferSuspend`/`abortSuspend` side effects.** Can skip Amazon's own maintenance alarms. Test only during the spike.
9. **`kdb` t2 change.** Rootfs write, persistent, bootloop class. Excluded.
10. **Battery cost of the powerd path.** About 96 s awake per wake. At 1-minute wakes the device never sleeps. At 20-minute wakes it is awake about 8% of the time (inference).

## Recommendation

1. **Keep the powerd path (KOReader `WakeupMgr`) as the product path.** It is what KOReader, KindleCron and the PW3 project use, and the power button and Wi-Fi keep working. Data wakes every 10–20 min fit it. A 1-minute clock does not: drop the per-minute redraw while asleep (show "updated hh:mm", or redraw the clock only while awake).
2. **Then test whether `deferSuspend 1` shortens READY TO SUSPEND** on KOA3. This changes no config and resets at reboot.
3. **Treat direct suspend as research only.** Run it only after steps 1–2, with the plan below. Do not ship it unless 20 direct cycles in a row pass on KOA3.

### Safe test plan

Every step: device on battery, at a desk, owner watching, SSH open, nothing in any autostart. Write a procedure in `docs/procedures/` before step D (project rule).

- **A. Read only (no risk).** Over SSH: `lipc-probe -v com.lab126.powerd`; `strings /usr/bin/powerd | grep -i -E 'rtcWakeup2|defer|grace|t2|wakealarm|rtc'` (looks for the `rtcWakeup2` format and what powerd writes before suspend); `kdb get system/daemon/powerd/t2_timeout`; `kdb get system/daemon/powerd/r2s_grace_timeout`; `cat /sys/power/wakeup_count`; `ls /sys/power/`. Save the output to `/mnt/us`.
- **B. powerd baseline.** One `powerButton 1` sleep with `rtcWakeup 300` from KOReader. Log the times of `goingToScreenSaver`, every `readyToSuspend` level, the kernel `PM: suspend entry/exit` (`dmesg`), `wakeupFromSuspend`, and the first redraw. Stop: power button. This measures resume latency (Q4).
- **C. `deferSuspend` probe.** Same as B, but write `deferSuspend 1` right after `rtcWakeup` on the last level. Check `powerd_test -s` and the powerd log: did suspend come about 1 s later, and was our alarm the one programmed (`set_wakealarm` epoch)? Stop: power button. If the device goes back to ACTIVE or the alarm is wrong, drop this idea.
- **D. One direct suspend, framework stopped, short alarm.** Start KOReader with `--framework_stop` (or stop `lab126_gui` from SSH). `preventScreenSaver 0`, Wi-Fi off, `echo 0 > /sys/class/rtc/rtc0/wakealarm`, `echo +60 > .../wakealarm`, read back and check > now + 2, `sync`, `echo mem > /sys/power/state`. One cycle only, no loop.
  - Pass: wakes in 60–65 s, `dmesg` shows suspend exit, the power button still wakes it from a second manual test, Wi-Fi comes back.
  - Stop/recover: no wake in 2 min → short power press → plug USB → hold power 40 s. Write down which one worked.
- **E. If D passed:** repeat with the framework running (the kindle-gadget case) only if needed. Then 5, then 20 cycles with a hard stop after 1 hour, a kill-switch file, and a 3-failures-then-stay-awake rule.
