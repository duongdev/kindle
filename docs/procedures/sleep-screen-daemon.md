# Sleep-screen daemon (manual run)

Issue 08, ADR 0002. Run the daemon by hand from SSH. No boot hook yet (issue 09).

## What it changes

- At run time only: `lipc com.lab126.blanket unload screensaver` (stock sleep screen off), `lipc com.lab126.powerd rtcWakeup` (wake alarm). Both reset at reboot.
- Files: `/mnt/us/dashd/` (script, STOP file), `/tmp/dashd.raw`, `/tmp/dashd.log` (moved to `/tmp/dashd.log.1` at 256 KB), `/tmp/dashd.pid`, `/tmp/fbink` (copy of KOReader's FBInk, so draws work in USB drive mode). Nothing on the rootfs.
- On a self-wake it presses the power button through powerd to get Wi-Fi, then sleeps again. It presses only when powerd is in the expected state, so a user press in the same seconds does not leave the device awake. It also runs while KOReader is open (KOReader sleep screen: "Leave screen as-is", no message).
- Only one copy runs: a second start sees `/tmp/dashd.pid` and exits. If the powerd event stream ends, the daemon starts it again after 5 s.

## Battery rules

- Night (`NIGHT_START` to `NIGHT_END`, hours, default 0 to 6): the device wakes once per 3500 s and does not refresh.
- Failed refresh (no Wi-Fi or no server): the interval doubles from the 2nd failure, up to 3500 s. From the 4th failure in a row, only every 4th wake tries. One good fetch resets this.
- Battery at 5% or less and not charging: no refresh and no wake alarm, and the stock screensaver module is loaded again. Refresh starts again when the battery is above 5% or charging.
- If the framebuffer is rotated (`/sys/class/graphics/fb0/rotate` is not 0), the daemon does not draw and logs it.

## Before

1. KOReader closed (stock home). On battery, Wi-Fi on, SSH over Wi-Fi.
2. Read-only probe done (issue 11): `wget`, `lipc-wait-event` and `/mnt/us/koreader/fbink` exist. KOReader's FBInk has no image support and `eips -g` draws 3x wide on this panel, so the daemon writes the server's `/screen/sleep.raw` bytes to `/dev/fb0` and uses FBInk only to refresh; `lipc-get-prop com.lab126.blanket load` lists `screensaver`.
3. Server answers: `curl http://192.168.1.102:10060/healthz`.

## Run

1. Copy: `scp -r kindle/dashd root@kindle:/mnt/us/` (SSH options in `ssh.md`).
2. Start detached, from a `/tmp` copy (USB drive mode unmounts `/mnt/us`): `cp /mnt/us/dashd/dashd.sh /tmp/ && setsid sh /tmp/dashd.sh </dev/null >/dev/null 2>&1 &`
3. For a quick test set a short interval: `INTERVAL=300 setsid sh ...` (300 s). Set `NIGHT_START` and `NIGHT_END` to the same value to turn the night window off.
4. Or do all of this with `scripts/dashd-restart.sh` from the computer (it also stops the old copy).
5. Press the power button. Expected: the dashboard image appears instead of the stock sleep screen.
6. Wait 2 or 3 intervals. Expected: "Cập nhật lúc" time changes.
7. Press the power button. Read `/tmp/dashd.log`.

## Stop

- `touch /mnt/us/dashd/STOP`; the daemon exits at the next powerd event and loads the stock screensaver again. Or `for p in $(pgrep -f '^sh /tmp/dashd.sh'); do pkill -P $p; kill $p; done; rm -f /tmp/dashd.pid` and `lipc-set-prop com.lab126.blanket load screensaver`. Never `pkill lipc-wait-event` by pattern: KOReader and the system run their own powerd listeners.
- A reboot clears everything (lipc state and `/tmp`).

## Recovery

- No image, stock sleep screen instead: the daemon is not running or KOReader is open. Harmless.
- Blank or stuck screen: press the power button; if no response, hold it for up to 40 s (forced restart).
- Device does not wake by itself: the alarm was not set; press the power button. Battery cost only.

## Record

Wake times and battery from `/tmp/dashd.log`, first draw time after `goingToScreenSaver`, and whether the stock UI ever draws over the image. Write them in issue 08.
