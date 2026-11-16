# 1. Jailbreak with SpiderCat, modern flow

Date: 2026-11-16. Status: accepted (not yet run).

## Context

KOA3 on 5.18.2.1.1, ad-free. The kindlemodding.org wizard matches SpiderCat, Nosebleed, and Sanctuary. See docs/research/05-jailbreak-risks.md.

## Decision

Use SpiderCat, then the modern post-jailbreak flow (KPM, Jobman with recovery, KOReader via KPM). Nosebleed is the fallback. Do not use Sanctuary on this device. Do not install hotfix, KUAL, MRPI, or USBNetwork unless a package needs them.

## Consequences

- Success is reported on our exact firmware; the known hang has a known fix (forced restart).
- No hard-brick recovery exists for KOA3, so all later dev work stays off the rootfs and boot partitions.
