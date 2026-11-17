import type { CalEvent } from "./model.ts";
import { hhmm, sameDay } from "./vi.ts";

const HIDE_TITLE = /^(canceled|cancelled|đã hủy):/i;

export interface HomeAgenda {
  header: string;
  next?: { event: CalEvent; inProgress: boolean };
  // Up to 2 one-line rows. The last row may carry a "+N" count of hidden events.
  rows: { text: string; time?: string; more?: number }[];
  tomorrow?: CalEvent;
  empty?: string;
}

const visible = (events: CalEvent[]) => events.filter((e) => !HIDE_TITLE.test(e.title));
const byStart = (a: CalEvent, b: CalEvent) =>
  a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime();

// overflow.md "Home agenda": all-day events merge into one row; timed events by start; "+N" in the last row.
export function homeAgenda(all: CalEvent[], now: Date): HomeAgenda {
  const events = visible(all);
  const today = events.filter((e) => (e.allDay ? e.start <= now && e.end > now : sameDay(e.start, now)));
  const timed = today.filter((e) => !e.allDay).sort(byStart);
  const allDay = today.filter((e) => e.allDay);
  const past = timed.filter((e) => e.end <= now);
  const left = timed.filter((e) => e.end > now);

  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrow = events.filter((e) => !e.allDay && sameDay(e.start, tomorrowDate)).sort(byStart)[0];

  const header = `còn ${left.length} sự kiện · ${past.length} đã qua`;
  const [nextEvent, ...rest] = left;
  const rows: HomeAgenda["rows"] = [];
  if (allDay.length) {
    const names = allDay.slice(0, 2).map((e) => e.title);
    const more = allDay.length - names.length;
    rows.push({ time: "Cả ngày", text: names.join(" · ") + (more > 0 ? ` · +${more}` : "") });
  }
  const slots = 2 - rows.length;
  const shown = rest.slice(0, slots);
  for (const e of shown) rows.push({ time: hhmm(e.start), text: (e.tentative ? "? " : "") + e.title });
  const hidden = rest.length - shown.length;
  if (hidden > 0 && rows.length) rows[rows.length - 1].more = hidden;

  return {
    header,
    next: nextEvent ? { event: nextEvent, inProgress: nextEvent.start <= now } : undefined,
    rows,
    tomorrow,
    empty:
      nextEvent || allDay.length ? undefined : events.some((e) => e.end > now) ? "Hôm nay trống" : "Không có sự kiện",
  };
}

// The sleep screen shows absolute times only; awake screens count down to the next event.
export function nextLabel(start: Date, inProgress: boolean, now: Date, countdown: boolean): string {
  if (inProgress) return "đang diễn ra";
  if (!countdown) return "tiếp theo";
  const min = Math.round((start.getTime() - now.getTime()) / 60_000);
  return min < 60 ? `${min} phút nữa` : `${Math.floor(min / 60)} giờ nữa`;
}

export interface AgendaRow {
  time: string;
  title: string;
  // Calendar name, "N lịch", "ngày 2/3", or the countdown on the next event.
  tag: string;
  past?: boolean;
  next?: boolean;
  more?: boolean;
}

export const DAY_SLOTS = 5;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000);
const titled = (e: CalEvent) => (e.tentative ? "? " : "") + e.title;

function allDayRow(events: CalEvent[], day: Date): AgendaRow {
  const names = events.slice(0, 2).map(titled);
  const more = events.length - names.length;
  const first = events[0];
  const span = daysBetween(first.start, first.end);
  const calendars = new Set(events.map((e) => e.calendar)).size;
  const tag =
    events.length > 1
      ? calendars > 1
        ? `${calendars} lịch`
        : first.calendar
      : span > 1
        ? `ngày ${daysBetween(first.start, day) + 1}/${span}`
        : first.calendar;
  return { time: "Cả ngày", title: names.join(" · ") + (more > 0 ? ` · +${more}` : ""), tag };
}

// overflow.md "Agenda day": up to DAY_SLOTS rows. All-day events merge into row 1; past events drop first;
// then the last row becomes "+N sự kiện (HH:MM–HH:MM)". Empty array = no events that day.
export function agendaDay(all: CalEvent[], day: Date, now: Date): AgendaRow[] {
  const from = dayStart(day);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  const events = visible(all);
  const allDay = events.filter((e) => e.allDay && e.start < to && e.end > from);
  const timed = events.filter((e) => !e.allDay && sameDay(e.start, from)).sort(byStart);

  const rows: AgendaRow[] = allDay.length ? [allDayRow(allDay, from)] : [];
  const slots = DAY_SLOTS - rows.length;
  let excess = timed.length - slots;
  const kept: CalEvent[] = [];
  for (const e of timed) {
    if (excess > 0 && e.end <= now) excess--;
    else kept.push(e);
  }
  const shown = kept.length <= slots ? kept : kept.slice(0, slots - 1);
  const hidden = kept.slice(shown.length);
  const next = sameDay(from, now) ? kept.find((e) => e.end > now) : undefined;

  for (const e of shown) {
    rows.push({
      time: `${hhmm(e.start)}–${hhmm(e.end)}`,
      title: titled(e),
      tag: e === next ? nextLabel(e.start, e.start <= now, now, true) : e.calendar,
      past: e.end <= now,
      next: e === next,
    });
  }
  if (hidden.length) {
    const start = Math.min(...hidden.map((e) => e.start.getTime()));
    const end = Math.max(...hidden.map((e) => e.end.getTime()));
    rows.push({
      time: "",
      title: `+${hidden.length} sự kiện (${hhmm(new Date(start))}–${hhmm(new Date(end))})`,
      tag: "",
      more: true,
    });
  }
  return rows;
}
