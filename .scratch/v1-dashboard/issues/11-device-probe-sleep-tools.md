# Device probe for sleep-screen tools

Status: ready-for-agent

Read-only SSH checks: `kmc.conf` present and its version, FBInk and `lipc-wait-event` available, loaded blanket modules, Jobman recovery installed, `/sys/power` state. Also test whether `lipc powerd deferSuspend 1` shortens READY TO SUSPEND (procedure first; lipc values reset at reboot).
