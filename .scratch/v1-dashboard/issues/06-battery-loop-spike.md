# Battery loop spike

Status: resolved
Blocked by: 04, 05

Find out whether a KOReader plugin can do what re-kindle loop.sh does: Wi-Fi on only during fetch, RTC wake, suspend, night window, skip unchanged redraws. If not, decide between a shell loop that owns the schedule and KOReader for interactive sessions only. Record the result as an ADR.

## Risk

Main project risk. KOReader is the chosen runtime, but nothing confirms yet that a plugin can set an RTC wake, toggle Wi-Fi, and suspend on KOA3. If it cannot, the battery target (about 10% per week, as in re-kindle) needs a shell loop that owns the schedule, and KOReader only runs interactive sessions. Resolve this before building dashboard features.

## Progress (2026-11-17)

Code study (KOReader v2026.07.x, `frontend/device/kindle/`):

- KOReader already has an RTC wake path on Kindle. `Device.wakeup_mgr:addTask(seconds, fn)` stores the alarm. In the powerd `readyToSuspend` state, KOReader sends it as `lipc com.lab126.powerd rtcWakeup <seconds>`. 15 s after the wake, if powerd is still in `screenSaver` or `suspended`, KOReader runs the task. A power-button wake goes to `active`, so the task does not run. The stock AutoSuspend plugin uses this path for auto power-off.
- `UIManager:suspend()` sends `powerd powerButton 1`, the same as a button press.
- Wi-Fi on Kindle: `lipc com.lab126.wifid enable` and `com.lab126.cmd wirelessEnable`. `NetworkMgr:turnOnWifi` also shows a scan popup, so the spike calls lipc directly.
- Sleep screen "Leave screen as-is" with no message draws nothing at sleep, so the last screen stays (`ui/screensaver.lua`).

Device probe (read-only, over SSH):

- Device KOReader is v2026.07.1. The emulator is a later nightly.
- powerd properties include `rtcWakeup` (w), `rtcWakeup2` (w, string), `deferSuspend`, `suspendGrace`, `abortSuspend`, `preventScreenSaver`, `wakeUp`.
- powerd timeouts: `t1_timeout` 600 s (active to screen saver), `t2_timeout` 60 s.
- Hibernation is on: `hibernate.s2h.rtc.secs` = 3600. After 1 h of suspend, the device hibernates (RAM to eMMC). `hibernate.max.count` = 34500 suggests a wear limit. A wake interval below 3600 s avoids hibernation. Unverified: whether our RTC wake works from hibernation.
- In suspend, SSH over Wi-Fi does not answer.

Spike: `plugins/loopspike.koplugin`, procedure `docs/procedures/loop-spike.md`. It runs three wake rules: clock 1 min, calendar 10 min, Wi-Fi 20 min, with one shared alarm. Emulator run passes at 10x speed (no RTC or suspend there, timer only). Device run is next.

## Device run 1 (2026-11-17, rules 1/10/20 min via powerd)

Result: no RTC wake. The clock did not refresh. Source: `/mnt/us/loopspike.log` and `/var/local/log/messages_00000277*`, `messages_00000278*`.

Timeline:

- 10:07:42 `UIManager:suspend()`. powerd: ACTIVE -> SCREEN SAVER. KOReader schedules the clock wake for 10:09:00.
- 10:08:42 SCREEN SAVER -> READY TO SUSPEND (60 s, `t2_timeout`). powerd sends `readyToSuspend` again about every 5 s. Each time KOReader sets `rtcWakeup` (18 s, then 13 s, ...). powerd logs "Setting RTC wakeup to Ns after suspend": the delay counts from the real suspend, not from now.
- 10:09:00 The alarm time passes while powerd is still in READY TO SUSPEND. KOReader drops the task (`readyToSuspend` removes past alarms).
- 10:09:18 READY TO SUSPEND -> SUSPENDED after 36 s. Only the powerd hibernate RTC (+3600 s) is set.
- 10:15:56 Power button wake.

Findings:

- Through powerd, sleep starts about 96 s after the request (60 s screen saver + about 36 s ready to suspend). After an RTC wake powerd goes SUSPENDED -> SCREEN SAVER, so each wake likely costs the same window awake. A 1 min clock is not possible this way, and a 10 min wake is awake about 15% of the time.
- The framework is running (`cvm` is alive), so KOReader started with the framework on this device.
- Bug: `NetworkMgr:turnOffWifi()` on Kindle also sets `com.lab126.cmd wirelessEnable 0`, which is airplane mode. Use `com.lab126.wifid enable 0` only.

Next: a direct-suspend path (own RTC alarm + `echo mem > /sys/power/state`, as in re-kindle) to get short wakes and an exact :00 redraw. Needs a procedure and a risk check first: it bypasses powerd, which is running.

## Answer

A KOReader plugin can set an RTC wake, toggle Wi-Fi and suspend, but only through powerd, and each wake costs at least 60 s awake. A per-minute sleep clock is not possible; direct suspend is research only (docs/research/08-direct-suspend.md). Decision: ADR 0002 (server-rendered dashboard, sleep-screen daemon on the stock home, refresh every 20-30 min). Follow-up: issues 07-12.
