# Battery loop spike

Status: needs-triage
Blocked by: 04, 05

Find out whether a KOReader plugin can do what re-kindle loop.sh does: Wi-Fi on only during fetch, RTC wake, suspend, night window, skip unchanged redraws. If not, decide between a shell loop that owns the schedule and KOReader for interactive sessions only. Record the result as an ADR.

## Risk

Main project risk. KOReader is the chosen runtime, but nothing confirms yet that a plugin can set an RTC wake, toggle Wi-Fi, and suspend on KOA3. If it cannot, the battery target (about 10% per week, as in re-kindle) needs a shell loop that owns the schedule, and KOReader only runs interactive sessions. Resolve this before building dashboard features.
