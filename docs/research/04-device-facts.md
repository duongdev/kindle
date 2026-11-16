# Device facts

Read from the device over USB on 2026-11-16. No serial numbers or account IDs are stored in this repo. Put such data in `private/` (gitignored).

| Fact | Value | How |
|---|---|---|
| Model | Kindle Oasis 10th gen (KOA3), confirmed | USB serial chars 4–6 = `0WL`, in KOReader's `koa3_set` ([device.lua](https://github.com/koreader/koreader/blob/master/frontend/device/kindle/device.lua)) |
| Firmware | 5.18.2.1.1, build `482111 015` | `system/version.txt` |
| USB mode | Mass storage, FAT32, volume `Kindle` | `diskutil info`. Not MTP, which Nosebleed requires. |
| Storage | 8 GB model (6.7 GB user partition, 6.1 GB free) | `df` |
| `.active_content_sandbox/` | Present (`audibleupsell/`, `browser/`) | `ls`. This is the folder that WinterBreak and AdBreak use. |
| Special Offers (ads) | No (ad-free) | No lock screen ads ever seen. No Personalized Offers in Settings > Your Account. |

## Read over SSH (root), 2026-11-16, after jailbreak

| Fact | Value |
|---|---|
| Kernel | Linux 4.1.15-lab126, armv7l, 2 cores |
| RAM | 482 MB total, about 199 MB available after cache; 127 MB swap |
| TUN | **None.** `/dev/net/tun` missing, `CONFIG_TUN is not set`. VPNs must run in userspace mode. |
| `/var/local` | 240 MB, 178 MB free |
| `/` (rootfs) | 494 MB, **95% full** (24 MB free). Never write there. |
| `/mnt/us` | 6.2 GB, 6.0 GB free |
| RTC | `rtc0`, `rtc1`, `rtc2`; `rtc0` has `wakealarm` |
| `iptables` | present (`/usr/sbin/iptables`) |

## USB troubleshooting

There is no USB setting on the Kindle. The first attempt failed at the hardware level: the Kindle did not show in `ioreg -p IOUSB` at all. A different cable or port fixed it. Amazon's USB vendor ID is `6473` (0x1949).
