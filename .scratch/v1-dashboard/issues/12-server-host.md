# Choose the server host

Status: resolved

Pick the always-on LAN machine for the dashboard server (Homebridge box, Home Assistant box, or other). Needs: Node or Python, headless Chromium, about 300 MB RAM while rendering. Owner decides.

## Answer

2026-11-17: owner chose the homelab Docker host, deployed as a Portainer stack. Host: VM `portainer` (Ubuntu 24.04, Docker 29 snap, Portainer CE). Checked over SSH (read-only): about 5.7 GB RAM available, 41 GB disk free, host port 10060 unused. Plan: Node/TypeScript server with Playwright (Chromium) for rendering, one container, secrets in the stack env. Develop and test on the Mac first.

Risk: the owner's homelab notes say Home Assistant may be retired in favour of Homebridge + Apple Home. Room sensors and the ACs are read through HA today. If HA goes, they need another path.
