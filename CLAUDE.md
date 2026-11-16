# CLAUDE.md

Turn a jailbroken Kindle Oasis 10th gen into a battery-powered dashboard and home-control panel with tap and swipe input. The chosen runtime is a KOReader plugin (Lua).

## Device

- Kindle Oasis 10th gen ("KOA3"), firmware 5.18.2.1.1 at project start.
- Firmware 5.16.3 and later is armhf. Use the `kindlehf` toolchain target for native code.
- Device facts that are not yet confirmed on the real device are marked "unverified". Confirm them before you depend on them.
- Keep the device in Airplane mode until the jailbreak and hotfix are installed. An Amazon update can close the jailbreak path.

## Layout

- `docs/research/`: findings. One topic per file, with sources.
- `docs/procedures/`: step-by-step device procedures (jailbreak, deploy, recovery).
- `docs/adr/`: decisions. See `docs/agents/domain.md`.
- `.scratch/<feature>/`: specs and issues. See `docs/agents/issue-tracker.md`.

## Conventions

- Do not run anything on the device that cannot be undone without first writing a procedure in `docs/procedures/`.
- Research notes cite the source URL for each claim. Mark claims from a single forum post as weak.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
