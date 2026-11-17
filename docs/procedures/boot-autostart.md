# Boot autostart of the sleep-screen daemon

Issue 09. Starts `kindle/dashd/dashd.sh` at every boot through SpiderCat's boot hook.

## How it works

- SpiderCat's jailbreak installed `/etc/upstart/kmc.conf`. On `framework_ready` (the stock UI is already up) it runs `/mnt/us/emergency.sh` if the file exists, then stops. Nothing else in that job runs after it.
- Our `emergency.sh` (from `kindle/dashd/emergency.sh`) exits at once. It starts a detached shell that waits 60 s, copies the daemon to `/tmp`, and runs it with a 30 min interval.
- Nothing is written to the root filesystem. All files are on `/mnt/us`.
- A daemon started by hand during the 60 s wait is safe: the boot copy sees `/tmp/dashd.pid` and exits.

Risk R26 in `docs/research/05-jailbreak-risks.md` is about running someone else's `emergency.sh`. This one is ours and is kept in the repo.

## Install

1. Daemon in place: `/mnt/us/dashd/dashd.sh` (see `sleep-screen-daemon.md`).
2. Copy the hook: `scp kindle/dashd/emergency.sh root@kindle:/mnt/us/emergency.sh` (SSH options in `ssh.md`).
3. Test by hand first: stop the running daemon (`pkill -f '^sh /tmp/dashd.sh'`), run `sh /mnt/us/emergency.sh`, wait 65 s, check `ps | grep dashd` and `/tmp/dashd.log` ("interval 1800 s").
4. Reboot (`reboot` over SSH, or the Kindle menu). After 2 min check `/tmp/dashd.log` again.

## Turn it off

- Quick: `touch /mnt/us/dashd/DISABLE` and reboot. Remove the file to turn it on again.
- Full: `rm /mnt/us/emergency.sh` and reboot.
- From a computer without SSH: USB drive mode, then delete `emergency.sh` from the Kindle drive (it is in the drive's top folder).

## Recovery

- The hook runs after the stock UI is up and returns at once, so it cannot block the boot.
- If the daemon misbehaves (screen stuck on the dashboard, wakes too often): press the power button, then use "Turn it off" above. A forced restart (hold power up to 40 s) clears `/tmp`, so the daemon only starts again through the hook.
