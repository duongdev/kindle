# Sleep-screen daemon (manual run)

Status: ready-for-agent
Blocked by: 07, 11

Shell daemon on the Kindle, started by hand over SSH from `/tmp`. On `goingToScreenSaver` and on each RTC wake it unloads the blanket screensaver, downloads the sleep PNG, draws it with FBInk, and sets the next `rtcWakeup` (20-30 min, below 3600 s) on `readyToSuspend`. Does nothing while KOReader runs. Wi-Fi off with `wifid enable 0` only. A kill-switch file stops it. Write the procedure first.

Done when: one night on battery with the dashboard on the sleep screen, log read, battery drop recorded.

See docs/research/09-stock-home-dashboard.md.

## Progress (2026-11-17)

Probe (issue 11): `wget`, `lipc-wait-event`, `setsid`, `eips`, `/mnt/us/koreader/fbink` present; blanket modules `screensaver langpicker blankwindow usb`; `kmc.conf` v2.6.0 present; server reachable from the Kindle.

Findings from the manual run:

- KOReader's FBInk is built without image support ("Image support is disabled in this FBInk build"). `eips -g` draws PNGs 3x wide on this panel (it writes 3 bytes per pixel into the 8-bit framebuffer; read back from `/dev/fb0`). Fix: the server serves `/screen/sleep.raw` (1280x1680 Y8, framebuffer stride 1280, 1264 visible); the daemon writes it to `/dev/fb0` with `dd` and calls `fbink -f -s` for a full refresh.
- The stock UI draws its dimmed home after `goingToScreenSaver`, even with the blanket `screensaver` module unloaded. Drawing 2 s after the event wins.
- After a button wake the stock UI does not repaint (we drew behind its back), so taps repaint only parts. Fix: save `/dev/fb0` at `goingToScreenSaver` and write it back with a full refresh on `outOfScreenSaver`. Verified clean by the owner.
- `rtcWakeup` is accepted on every `readyToSuspend` level (10, 8, 7, 7, 6, 2, 1 over 45 s). RTC wake itself not verified yet.
- Pitfall: `pgrep -f` patterns also match the ssh command's own shell; use `scripts/dashd-restart.sh` (anchored `pkill -f '^sh /tmp/dashd.sh'`).
- RTC wake verified (powerd `reason = RTC` at the 300 s and 90 s marks; the daemon gets `wakeupFromSuspend` in `screenSaver` state).
- Wi-Fi does not come up in the `screenSaver` state after an RTC wake: `cmd` stays in state `NA`. `lipc com.lab126.cmd ensureConnection wifi:<essid>` reaches cmd ("Got a connection request") but changes nothing; `lipc com.lab126.wifid cmConnect <essid>` does nothing either.
- Working fix: on an RTC wake the daemon sends `lipc com.lab126.powerd powerButton 1` (device goes ACTIVE, cmd goes READY), Wi-Fi connects in about 3 s, it fetches, then sends `powerButton 1` again to go back to sleep and redraws after `goingToScreenSaver`. A flag file stops it from restoring the home screen on its own wake. Verified 13:51 (fetch ok 20 s after the wake). Cost per refresh: about 20 s active plus powerd's usual 60 s screen saver and about 36 s ready-to-suspend.
- 2026-11-17 review round: pidfile (single instance), state checks around both powerButton presses, stale waking flag, backoff to 3500 s on failures, night window 00-06 (one wake per 3500 s, no refresh), stop at <= 5% battery, outer restart loop for the powerd event stream, fbink copied to /tmp, rotation check, log rotation. Restart kills only our daemon's children: KOReader and the system run their own powerd `lipc-wait-event` listeners. Deployed; boot copy and restart verified (one listener of ours, KOReader's and the system's intact).
- Not yet measured: frontlight during the full wake, `deferSuspend 1` to shorten READY TO SUSPEND.
