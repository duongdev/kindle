# Boot autostart through emergency.sh

Status: resolved
Blocked by: 08

Start the daemon at boot through SpiderCat's `kmc.conf` hook (`/mnt/us/emergency.sh`). Tiny script, kill-switch file, `setsid`, wait 60 s. Procedure and recovery first (risk R26). Needs owner approval before it goes on the device.

## Progress (2026-11-17)

Owner approved. `kindle/dashd/emergency.sh` installed as `/mnt/us/emergency.sh`; procedure `docs/procedures/boot-autostart.md`. `kmc.conf` (SpiderCat v2.6.0) runs it in the pre-start of a job on `framework_ready` and does nothing else after it. Manual run verified (daemon up 60 s later, interval 1800 s). Reboot test passed: after a reboot the daemon started at 14:49:16 (about 60 s after `framework_ready`) with interval 1800 s, the stock screensaver module was unloaded, and the next sleep drew a fresh dashboard (14:53:47). Note: Jobman's Wi-Fi SSH does not survive a reboot; turn it on again in Jobman.
