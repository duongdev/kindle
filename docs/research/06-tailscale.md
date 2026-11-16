# Tailscale on the Kindle (SSH over Wi-Fi from anywhere)

Researched 2026-11-16. Nothing installed yet.

**Decision 2026-11-16: parked.** SSH over the home Wi-Fi (LAN) is enough for now. Revisit if remote access away from home is needed.

## Key constraint: no TUN driver on KOA3 (confirmed on our device)

- A KOA3 owner on 5.18.2 says the Oasis 3 kernel has no TUN, so a normal VPN client cannot create an interface. One post, weak. ([Reddit](https://reddit.com/r/kindlejailbreak/comments/1xvjhvb/), [netbird-kindle](https://github.com/workshop144/netbird-kindle))
- Confirmed 2026-11-16 on our device: `/dev/net/tun` missing, `# CONFIG_TUN is not set`. Check used:

```sh
ls -l /dev/net/tun; grep tun /proc/misc; zcat /proc/config.gz 2>/dev/null | grep -i CONFIG_TUN
```

- Without TUN, Tailscale must run with `--tun=userspace-networking`:
  - **Inbound** TCP from the tailnet to the Kindle's Tailscale IP reaches local ports, so SSH over the tailnet works. ([kon3gor README](https://github.com/kon3gor/tailscale-koplugin))
  - **Outbound** from Kindle programs (KOReader, curl, our dashboard) to tailnet hosts goes through a local SOCKS5/HTTP proxy, not transparent routing. ([Tailscale docs](https://tailscale.com/kb/1112/userspace-networking))
  - No mesh DNS for local programs; use Tailscale IPs or the proxy.

## Options

| Option | How it installs | No-TUN support | Notes |
|---|---|---|---|
| [victoria-riley-barnett/koreader-tailscale](https://github.com/victoria-riley-barnett/koreader-tailscale) | KOReader plugin; the plugin downloads Tailscale binaries | Yes: "Force userspace mode" + HTTP proxy `127.0.0.1:1056` for KOReader | Most used (253 stars), updated 2026-11-11. QR or auth-key sign-in. No license file. |
| [kon3gor/tailscale-koplugin](https://github.com/kon3gor/tailscale-koplugin) | KPM repo (`kpm add-repo` must run from a shell, not the search bar) | Yes: picks mode by checking `/dev/net/tun` | Tested on PW12, 5.17.1.0.4, kindlehf, KOReader v2026.07.1, Tailscale 1.104.2. Scriptlet toggles the daemon without KOReader; reads `/mnt/us/tailscale/auth.key`. 1 star. |
| [TimmyKug/koreader-tailscale](https://github.com/TimmyKug/koreader-tailscale) | KOReader plugin | **No** (needs `/dev/net/tun`) | Not usable if TUN is missing. |
| [mitanshu7/tailscale_kual](https://github.com/mitanshu7/tailscale_kual) | KUAL extension | Yes (SOCKS5/HTTP proxy on 1055) | KUAL is legacy on our flow. Old. |
| [workshop144/netbird-kindle](https://github.com/workshop144/netbird-kindle) | KPM | Yes (userspace + forwarder + iptables) | NetBird, not Tailscale. Only one tested on KOA3 5.18.2. Pins the client SHA-256. |

## Issue to plan for: what listens on port 22

Jobman's Dropbear binds only to the USB interface (`-lusb0`, seen in its command line). Tailnet traffic in userspace mode arrives on localhost, so Jobman's SSH will **not** answer over Tailscale. Choices:

1. Tailscale SSH (`tailscale up --ssh`), served by `tailscaled` itself. Untested on a userspace node; test it.
2. KOReader's built-in SSH server (Network menu, port 2222, key auth from its own `authorized_keys`). Only runs while KOReader runs.
3. A second Dropbear bound to `127.0.0.1` with key-only auth. Most control, more setup.

## Risks

| Risk | Mitigation |
|---|---|
| A VPN client runs as root on the device; third-party plugins download binaries | Read the plugin code first. Prefer packages that pin checksums. |
| Auth key stored on `/mnt/us`, readable by anyone with the USB cable | Use a pre-auth key with a tag, single-use, and tight ACLs (tag can reach nothing, only your Mac can reach the Kindle). Delete the key file after sign-in. |
| Battery: `tailscaled` plus Wi-Fi always on drains it; links drop in sleep | Start Tailscale only for dev sessions. Do not tie it to the dashboard's sleep loop yet. |
| `/var/local` is small (netbird-kindle asks for 120 MB free there) | Check `df /var/local` before installing. |
| Wi-Fi on means update risk returns if update blocking ever fails | Jobman shows OTA disabled. Run `scripts/preflight.sh cleaned` after Wi-Fi sessions. |

## Proposed path

1. Done: no TUN, 178 MB free in `/var/local`, about 199 MB RAM available.
2. Install the victoria-riley-barnett plugin in KOReader, force userspace mode, sign in with a tagged auth key.
3. Test `tailscale ssh` from the Mac. If it fails, enable KOReader's SSH server with our key.
4. Write `docs/procedures/tailscale.md` and an ADR.
