import IcalExpander from "ical-expander";
import { config, env } from "../config.ts";
import type { CalEvent } from "../model.ts";
import { fixture } from "./http.ts";

const DAYS = 7;

interface IcalEvent {
  summary: string;
  startDate: { isDate: boolean; toJSDate(): Date };
  endDate: { toJSDate(): Date };
  component: { getFirstPropertyValue(name: string): unknown };
}

function hidden(calendar: string) {
  return config.hiddenCalendars.some((h) => h.toLowerCase() === calendar.toLowerCase());
}

export async function fetchEvents(now = new Date()): Promise<CalEvent[]> {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + DAYS * 86_400_000);

  if (env.fixtures) {
    return fixture<{
      events: { calendar: string; title: string; start: string; end: string; all_day: boolean; status: string }[];
    }>("calendar.json")
      .events.filter((e) => !hidden(e.calendar) && e.status !== "cancelled")
      .map((e) => ({
        calendar: e.calendar,
        title: e.title,
        // Date-only strings are local days, not UTC.
        start: new Date(e.all_day ? `${e.start}T00:00` : e.start),
        end: new Date(e.all_day ? `${e.end}T00:00` : e.end),
        allDay: e.all_day,
        tentative: e.status === "tentative",
      }));
  }

  if (!env.calendars.length) throw new Error("CALENDARS is not set");
  const out: CalEvent[] = [];
  for (const cal of env.calendars) {
    if (hidden(cal.name)) continue;
    const res = await fetch(cal.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`calendar ${cal.name} ${res.status}`);
    const { events, occurrences } = new IcalExpander({ ics: await res.text(), maxIterations: 1000 }).between(from, to);
    const items = [
      ...(events as IcalEvent[]).map((e) => ({ item: e, start: e.startDate, end: e.endDate })),
      ...(occurrences as { item: IcalEvent; startDate: IcalEvent["startDate"]; endDate: IcalEvent["endDate"] }[]).map(
        (o) => ({ item: o.item, start: o.startDate, end: o.endDate }),
      ),
    ];
    for (const { item, start, end } of items) {
      const status = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
      if (status === "CANCELLED") continue;
      out.push({
        calendar: cal.name,
        title: item.summary ?? "",
        start: start.toJSDate(),
        end: end.toJSDate(),
        allDay: start.isDate,
        tentative: status === "TENTATIVE",
      });
    }
  }
  return out;
}
