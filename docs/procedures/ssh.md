# Procedure: SSH to the Kindle (Wi-Fi first, USB as backup)

Status: working since 2026-11-16. Server: Jobman v1.2.2 Dropbear 2024.85.

## One-time setup (done)

1. Mac key used only for the Kindle: `~/.ssh/kindle_ed25519` (ed25519, no passphrase). Public key copied to `/mnt/us/jobman/ssh/etc/dropbear/authorized_keys` over USB drive mode.
2. `/mnt/us/jobman/ssh/etc/config.toml`: `ALLOW_PASSWORD_LOGIN = false` (original in `config.toml.bak`). Applies on the next SSH start. Verified: Dropbear runs with `-s`, password login is refused.
3. Mac: System Settings > Network > "RNDIS/Ethernet Gadget" > TCP/IP: Manually, `192.168.15.1`, mask `255.255.255.0`, no router.

## Each session: Wi-Fi (default)

1. Kindle on the home Wi-Fi. Jobman > SSH & USB Networking > start SSH over Wi-Fi. The USB cable is not needed and stays in drive mode.
2. Connect (the Kindle's address on 2026-11-16 was `192.168.1.24`; it can change, consider a DHCP reservation on the router):

```sh
ssh -i ~/.ssh/kindle_ed25519 -o IdentitiesOnly=yes root@192.168.1.24
```

3. Copy files over SSH; no USB needed. The SFTP home is `/mnt/us` (the USB-visible storage). Verified with a 1 MB checksum test.

```sh
scp -i ~/.ssh/kindle_ed25519 -o IdentitiesOnly=yes FILE root@192.168.1.24:/mnt/us/documents/
sftp -i ~/.ssh/kindle_ed25519 -o IdentitiesOnly=yes root@192.168.1.24
```

`scp` and `sftp-server` exist on the device; `rsync` does not.

Verified 2026-11-16: key login works, password login refused. In Wi-Fi mode Dropbear listens on all interfaces (no `-l`), and Jobman adds one firewall rule: `-A INPUT -i wlan0 -p tcp --dport 22 -j ACCEPT`. Anyone on the home network can reach port 22; login still needs the key.

## Each session: USB (backup)

1. Kindle plugged in. Jobman (`;kpm launch jobman`) > SSH & USB Networking > start USB SSH. The Kindle leaves USB drive mode.
2. Connect:

```sh
ssh -i ~/.ssh/kindle_ed25519 -o IdentitiesOnly=yes root@192.168.15.244
```

## Known issues

- Jobman cannot stop USB SSH on this device ("Error Occurred: Path is nonexistent", empty `jobman.log`). Workaround: Settings > Device Options > Restart. Restart also makes scriptlet icons appear.
- Dropbear listens only on `usb0` (`-lusb0`). It is not reachable over Wi-Fi or Tailscale.
- The connection warns that it does not use a post-quantum key exchange (Dropbear 2024.85). Acceptable on a USB-only link.

## Lockout recovery

If the key stops working: put the Kindle in USB drive mode (restart without starting SSH), set `ALLOW_PASSWORD_LOGIN = true` in `jobman/ssh/etc/config.toml` or restore `config.toml.bak`, restart, start SSH, log in with password `kindle`, fix the key, then turn passwords off again.
