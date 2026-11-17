# Sleep-screen daemon (manual run)

Issue 08, ADR 0002. Run the daemon by hand from SSH. No boot hook yet (issue 09).

## What it changes

- At run time only: `lipc com.lab126.blanket unload screensaver` (stock sleep screen off), `lipc com.lab126.powerd rtcWakeup` (wake alarm). Both reset at reboot.
- Files: `/mnt/us/dashd/` (script, STOP file), `/tmp/dashd.raw`, `/tmp/dashd.log`. Nothing on the rootfs.
- On a self-wake it presses the power button through powerd to get Wi-Fi, then sleeps again. It also runs while KOReader is open (KOReader sleep screen: "Leave screen as-is", no message).

## Before

1. KOReader closed (stock home). On battery, Wi-Fi on, SSH over Wi-Fi.
2. Read-only probe done (issue 11): `wget`, `lipc-wait-event` and `/mnt/us/koreader/fbink` exist. KOReader's FBInk has no image support and `eips -g` draws 3x wide on this panel, so the daemon writes the server's `/screen/sleep.raw` bytes to `/dev/fb0` and uses FBInk only to refresh; `lipc-get-prop com.lab126.blanket load` lists `screensaver`.
3. Server answers: `curl http://192.168.1.102:10060/healthz`.

## Run

1. Copy: `scp -r kindle/dashd root@kindle:/mnt/us/` (SSH options in `ssh.md`).
2. Start detached, from a `/tmp` copy (USB drive mode unmounts `/mnt/us`): `cp /mnt/us/dashd/dashd.sh /tmp/ && setsid sh /tmp/dashd.sh </dev/null >/dev/null 2>&1 &`
3. For a quick test set a short interval: `INTERVAL=300 setsid sh ...` (300 s).
4. Press the power button. Expected: the dashboard image appears instead of the stock sleep screen.
5. Wait 2 or 3 intervals. Expected: "Cập nhật lúc" time changes.
6. Press the power button. Read `/tmp/dashd.log`.

## Stop

- `touch /mnt/us/dashd/STOP`; the daemon exits at the next powerd event and loads the stock screensaver again. Or `kill $(pgrep -f "dash[d].sh")` and `lipc-set-prop com.lab126.blanket load screensaver`.
- A reboot clears everything (lipc state and `/tmp`).

## Recovery

- No image, stock sleep screen instead: the daemon is not running or KOReader is open. Harmless.
- Blank or stuck screen: press the power button; if no response, hold it for up to 40 s (forced restart).
- Device does not wake by itself: the alarm was not set; press the power button. Battery cost only.

## Record

Wake times and battery from `/tmp/dashd.log`, first draw time after `goingToScreenSaver`, and whether the stock UI ever draws over the image. Write them in issue 08.
