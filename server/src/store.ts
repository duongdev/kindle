import type { Snapshot, Source } from "./model.ts";
import { fetchEvents } from "./sources/calendar.ts";
import { fetchFan } from "./sources/fan.ts";
import { fetchRooms } from "./sources/ha.ts";
import { fetchLamp } from "./sources/homebridge.ts";
import { redact } from "./sources/http.ts";
import { fetchWeather } from "./sources/weather.ts";

// Each source keeps its last good value, so one failing source does not blank the screen (states.md).
export const snapshot: Snapshot = { rooms: {}, lamp: {}, fan: {}, weather: {}, events: {} };

// How long each source's data is good for. Home state changes often; the calendar fetch is the slow one.
const TTL_MS = { rooms: 60_000, lamp: 60_000, fan: 60_000, weather: 15 * 60_000, events: 5 * 60_000 };

// Bumped whenever the snapshot changes, so cached renders know when they are stale.
export const data = { version: 0 };

// Keeps the shown state of `src` for `ms`, for one device (other devices' holds stay), and drops any
// fetch already in flight: it may have read the device before the command.
export function hold(src: Source<unknown>, device: string, ms: number) {
  src.holds = { ...src.holds, [device]: Date.now() + ms };
  src.writes = (src.writes ?? 0) + 1;
}

const held = (src: Source<unknown>) => Object.values(src.holds ?? {}).some((t) => t > Date.now());

// One word per failure kind, for /healthz.
export function errorClass(error: string): string {
  if (/timeout|aborted/i.test(error)) return "timeout";
  if (/not set|in config/i.test(error)) return "config";
  const status = error.match(/ (\d{3})\b/);
  if (status) return `http ${status[1]}`;
  if (/fetch failed|ECONN|EHOST|ENOTFOUND|EAI_AGAIN/.test(error)) return "unreachable";
  return "error";
}

const inFlight = new Map<Source<unknown>, Promise<void>>();

export function refreshOne<T>(src: Source<T>, ttl: number, force: boolean, load: () => Promise<T>): Promise<void> {
  const running = inFlight.get(src);
  // A forced refresh must read after now, so it waits for the running fetch and then fetches again.
  if (running) return force ? running.then(() => refreshOne(src, ttl, true, load)) : running;
  if (held(src)) return Promise.resolve();
  if (!force && src.okAt && Date.now() - src.okAt.getTime() < ttl) return Promise.resolve();
  const writes = src.writes;
  const p = load()
    .then(
      (value) => {
        if (held(src) || src.writes !== writes) return;
        const changed = JSON.stringify(value) !== JSON.stringify(src.value) || src.error !== undefined;
        src.value = value;
        src.okAt = new Date();
        src.error = undefined;
        if (changed) data.version++;
      },
      (e: unknown) => {
        // Node's fetch hides the network reason (EHOSTUNREACH, ECONNREFUSED) in `cause`.
        const c = e instanceof Error ? (e.cause as { code?: string; message?: string } | undefined) : undefined;
        const cause = c ? ` (${c.code ?? c.message})` : "";
        const error = redact((e instanceof Error ? e.message : String(e)) + cause);
        if (error !== src.error) data.version++;
        src.error = error;
        console.warn("source failed:", error);
      },
    )
    .finally(() => inFlight.delete(src));
  inFlight.set(src, p);
  return p;
}

// force: refetch every source now (the "sync now" action); otherwise only sources past their TTL.
export function refresh(force = false): Promise<void> {
  return Promise.all([
    refreshOne(snapshot.rooms, TTL_MS.rooms, force, fetchRooms),
    refreshOne(snapshot.lamp, TTL_MS.lamp, force, fetchLamp),
    refreshOne(snapshot.fan, TTL_MS.fan, force, fetchFan),
    refreshOne(snapshot.weather, TTL_MS.weather, force, fetchWeather),
    refreshOne(snapshot.events, TTL_MS.events, force, () => fetchEvents()),
  ]).then(() => undefined);
}

let started = false;

// Requests never wait for the network once data exists: a timer keeps the snapshot fresh, so the Kindle
// (awake on battery) gets an answer in milliseconds. Only the very first request waits.
export async function ensureData(): Promise<void> {
  if (!started) {
    started = true;
    setInterval(() => void refresh(), 30_000).unref();
    await refresh();
  }
}

// /healthz: at least one source answered recently.
export const anyFresh = (maxAgeMs = 10 * 60_000) =>
  Object.values(snapshot).some((s: Source<unknown>) => s.okAt && Date.now() - s.okAt.getTime() < maxAgeMs);
