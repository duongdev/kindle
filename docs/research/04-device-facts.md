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

## USB troubleshooting

There is no USB setting on the Kindle. The first attempt failed at the hardware level: the Kindle did not show in `ioreg -p IOUSB` at all. A different cable or port fixed it. Amazon's USB vendor ID is `6473` (0x1949).
