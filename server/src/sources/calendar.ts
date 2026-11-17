import IcalExpander from "ical-expander";
import { config, env } from "../config.ts";
import type { CalEvent } from "../model.ts";
import { fixture, redact } from "./http.ts";

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
  const shown = env.calendars.filter((c) => !hidden(c.name));
  const results = await Promise.allSettled(shown.map((c) => calendarEvents(c, from, to)));
  const out: CalEvent[] = [];
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      out.push(...r.value);
      return;
    }
    failed++;
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    console.warn(`calendar ${shown[i].name} failed:`, redact(msg));
  });
  // One failing calendar keeps its last good events (below); only all failing with nothing cached is an error.
  if (failed && failed === results.length && !out.length) throw new Error("no calendar could be loaded");
  return out;
}

// Google's private iCal feeds can be several MB; a bigger body is refused, not parsed.
const MAX_ICS_BYTES = 5 * 1024 * 1024;
// ical-expander counts every occurrence from DTSTART, also the skipped ones before the window. Its default
// of 1000 drops a daily event that started 1000+ days ago. This bound only stops a runaway rule.
const MAX_ITERATIONS = 100_000;

interface Cached {
  ics: string;
  etag?: string;
  lastModified?: string;
  window?: number;
  events?: CalEvent[];
}
const cache = new Map<string, Cached>();

// Conditional GET: an unchanged feed (304) is not parsed again for the same window. On failure the last good
// events of this calendar are kept.
async function calendarEvents(cal: { name: string; url: string }, from: Date, to: Date): Promise<CalEvent[]> {
  const old = cache.get(cal.url);
  try {
    const headers: Record<string, string> = {};
    if (old?.etag) headers["If-None-Match"] = old.etag;
    if (old?.lastModified) headers["If-Modified-Since"] = old.lastModified;
    const res = await fetch(cal.url, { headers, signal: AbortSignal.timeout(15_000) });
    let entry: Cached;
    if (res.status === 304 && old) {
      entry = old;
    } else {
      if (!res.ok) throw new Error(`calendar ${cal.name} ${res.status}`);
      if (Number(res.headers.get("content-length") ?? 0) > MAX_ICS_BYTES)
        throw new Error(`calendar ${cal.name} too big`);
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > MAX_ICS_BYTES) throw new Error(`calendar ${cal.name} too big`);
      entry = {
        ics: body.toString("utf8"),
        etag: res.headers.get("etag") ?? undefined,
        lastModified: res.headers.get("last-modified") ?? undefined,
      };
    }
    if (entry.window !== from.getTime() || !entry.events) {
      entry.events = parse(cal.name, entry.ics, from, to);
      entry.window = from.getTime();
    }
    cache.set(cal.url, entry);
    return entry.events;
  } catch (e) {
    if (old?.events) {
      console.warn(`calendar ${cal.name}: keeping last good events`);
      return old.events;
    }
    throw e;
  }
}

function parse(calendar: string, ics: string, from: Date, to: Date): CalEvent[] {
  const { events, occurrences } = new IcalExpander({ ics, maxIterations: MAX_ITERATIONS }).between(from, to);
  const items = [
    ...(events as IcalEvent[]).map((e) => ({ item: e, start: e.startDate, end: e.endDate })),
    ...(occurrences as { item: IcalEvent; startDate: IcalEvent["startDate"]; endDate: IcalEvent["endDate"] }[]).map(
      (o) => ({ item: o.item, start: o.startDate, end: o.endDate }),
    ),
  ];
  const out: CalEvent[] = [];
  for (const { item, start, end } of items) {
    const status = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") continue;
    out.push({
      calendar,
      title: item.summary ?? "",
      start: start.toJSDate(),
      end: end.toJSDate(),
      allDay: start.isDate,
      tentative: status === "TENTATIVE",
    });
  }
  return out;
}
