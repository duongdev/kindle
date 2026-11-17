# Battery loop spike

Test whether a KOReader plugin can run the battery loop on the Kindle: RTC wake, Wi-Fi on, fetch, redraw, Wi-Fi off, sleep. Issue: `.scratch/v1-dashboard/issues/06-battery-loop-spike.md`.

## What the spike uses

Only KOReader APIs that already run on Kindle. Nothing is written outside `/mnt/us`.

- RTC wake: `Device.wakeup_mgr:addTask(seconds, fn)`. KOReader sends it to powerd as `lipc com.lab126.powerd rtcWakeup` in the `readyToSuspend` state. The stock AutoSuspend plugin (auto power-off) uses the same path.
- Sleep: `UIManager:suspend()`. This is the same as a power-button press (`powerd powerButton 1`).
- Wi-Fi on: `lipc com.lab126.wifid enable 1` (wifid reconnects to the saved network). Wi-Fi off: `NetworkMgr:turnOffWifi`.
- Log: `/mnt/us/loopspike.log`, one line per event, with the powerd state, battery and Wi-Fi state.

## Wake rules

| Rule | Every | Work |
| --- | --- | --- |
| clock | 1 min | Fast partial redraw. No Wi-Fi. |
| calendar | 10 min | Redraw from cached data, with a full (flashing) refresh. No Wi-Fi. |
| wifi | 20 min | Wi-Fi on, fetch, Wi-Fi off. Also does the calendar and clock work. |

- Due times align to the wall clock (clock on :00, calendar on :00/:10/..., Wi-Fi on :00/:20/:40).
- One RTC alarm at a time, for the earliest due rule. Rules due at the same time share one wake.
- A rule counts as due up to 30 s early, because powerd can fire the alarm up to 10 s early and KOReader runs the task 15 s after the wake.
- On every sleep (button or ours), the plugin sets the alarm again. Without this, a button sleep after the alarm time makes powerd drop the alarm.

## Safety

- The loop stops by itself after 1 hour (about 60 wakes).
- The longest sleep is 1 min, far below the hibernation delay (`hibernate.s2h.rtc.secs` = 3600). The device does not hibernate during the spike.
- The power button always wakes the device. KOReader runs as normal after that.
- To stop the loop: KOReader menu, More tools, Loop spike, Stop. Or restart KOReader.
- If KOReader does not respond: hold the power button for up to 40 s until the device restarts (Amazon's forced restart).
- To remove the plugin over SSH: `rm -rf /mnt/us/koreader/plugins/loopspike.koplugin`.
- Worst case: the device does not sleep and the battery drains. It cannot damage the device.

## Steps

1. On the Kindle, in KOReader: Settings (gear), Screen, Sleep screen.
   - Wallpaper: Leave screen as-is.
   - Sleep screen message: untick Add custom message to sleep screen.
2. Unplug USB. Wi-Fi on. Battery above 50%.
3. Deploy: `sh scripts/deploy.sh loopspike`. Restart KOReader.
4. KOReader menu, More tools, Loop spike, Start. The spike screen shows, then the device sleeps after 3 s.
5. Do not touch the device for about 1 hour.
6. Press the power button. Read the log over SSH (options in `docs/procedures/ssh.md`): `cat /mnt/us/loopspike.log`.
7. Record the result in issue 06.

## Questions the log answers

- Does the RTC wake fire? How late is it?
- How long is the device awake per clock wake? A 1 min clock may cost more battery than the rest together; compare battery drop with a 10 min clock later.
- Does KOReader get the task callback while powerd is in `screenSaver`?
- How long does Wi-Fi take to connect after a wake?
- Does powerd suspend again before the fetch and redraw finish?
- Does the screen keep the redraw while the device sleeps?
- Battery drop over 1 hour, per rule.
