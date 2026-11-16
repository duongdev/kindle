# Approaches to custom software on Kindle

Researched 2026-11-16.

## Jailbreak for firmware 5.18.2.1.1

| Method | Firmware | Condition | Status for KOA3 |
|---|---|---|---|
| WinterBreak | 5.16.4 – 5.18.0.2 | - | Does not apply |
| AdBreak | 5.18.1 – 5.18.5 | Special Offers (ads) must be on | One user reports success on 5.18.2 (weak) |
| Nosebleed (2026-02-03) | 5.16.4 – 5.18.6 | - | KOA3 listed as "possibly", unconfirmed |

After the jailbreak: install the hotfix (keeps the jailbreak through updates), KUAL (launcher), MRPI (package installer), and USBNetwork (SSH).

## Runtime layers, lightest to heaviest

1. Shell scripts + KUAL. Draw with `eips` or FBInk.
2. Native static binaries (C, C++, Rust, Go, Zig). Draw with FBInk or write `/dev/fb0` directly. Read touch from `/dev/input/eventN`.
3. Python 3 or Lua runtimes from MRPI packages.
4. KOReader plugins (Lua): e-ink-aware widgets, touch gestures, Wi-Fi, suspend. Desktop emulator for fast iteration. **Chosen.**
5. Amazon-native UI: GTK2 under X11, or HTML/JS in Amazon's framework. Old and limited.
6. Chroot distro (Alpine or Debian): modern packages, high RAM and battery cost.
7. Replace the OS: not realistic. Signed boot chain, no mainline kernel.

## System glue

- LIPC (Amazon IPC bus): `lipc-get-prop` and `lipc-set-prop`.
  - `com.lab126.cmd wirelessEnable 0|1`: Wi-Fi on or off.
  - `com.lab126.powerd preventScreenSaver 0|1`: block or allow powerd sleep.
  - `com.lab126.powerd battLevel`: battery percent.
  - `com.lab126.appmgrd start app://com.lab126.booklet.home`: go to the Kindle home screen.
- The Kindle UI process is `cvm`. `killall -STOP cvm` pauses it so it does not draw over you. `killall -CONT cvm` resumes it.
- Suspend with an RTC wake: write `+N` to `/sys/class/rtc/rtc*/wakealarm`, then `echo mem > /sys/power/state`.

## Constraints

- Touch does not wake the device from suspend. Only the power button or the cover sensor can wake it.
- Wi-Fi is off during suspend. Allow a few seconds to reconnect after wake.
- E-ink: a partial refresh is fast but leaves ghosting. A full refresh flashes. Wait for the refresh to finish before you suspend, or the screen stays half-drawn.
- Old userland (BusyBox, old glibc, old TLS stack). Plain HTTP can be more reliable than HTTPS for some APIs.

## Sources

- https://kindlemodding.org/jailbreaking/Nosebleed/
- https://kindlemodding.org/jailbreaking/WinterBreak2/
- https://kindlemodding.org/jailbreaking/jailbreak-faq
- https://www.mobileread.com/forums/showthread.php?p=4539338 (AdBreak range)
- https://www.mobileread.com/forums/showthread.php?p=4544666 (5.18.2 report)
- https://www.androidauthority.com/amazon-old-kindle-jailbreak-how-3669128/
