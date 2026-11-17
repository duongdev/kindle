import { inspect } from "node:util";
import type { Snapshot, Source } from "./model.ts";
import { fetchEvents } from "./sources/calendar.ts";
import { fetchFan } from "./sources/fan.ts";
import { fetchRooms } from "./sources/ha.ts";
import { fetchLamp } from "./sources/homebridge.ts";
import { fetchWeather } from "./sources/weather.ts";

// Each source keeps its last good value, so one failing source does not blank the screen (states.md).
export const snapshot: Snapshot = { rooms: {}, lamp: {}, fan: {}, weather: {}, events: {} };

async function refreshOne<T>(src: Source<T>, load: () => Promise<T>) {
  try {
    src.value = await load();
    src.okAt = new Date();
    src.error = undefined;
  } catch (e) {
    // Node's fetch hides the network reason (EHOSTUNREACH, ECONNREFUSED) in `cause`.
    const cause = e instanceof Error && e.cause ? ` (${inspect(e.cause, { depth: 1, breakLength: Infinity })})` : "";
    src.error = (e instanceof Error ? e.message : String(e)) + cause;
    console.warn("source failed:", src.error);
  }
}

// Bumped whenever the snapshot changes, so cached renders know when they are stale.
export const data = { version: 0 };

let inFlight: Promise<void> | undefined;
let lastRefresh = 0;

export function refresh(maxAgeMs = 60_000): Promise<void> {
  if (inFlight) return inFlight;
  if (Date.now() - lastRefresh < maxAgeMs) return Promise.resolve();
  inFlight = Promise.all([
    refreshOne(snapshot.rooms, fetchRooms),
    refreshOne(snapshot.lamp, fetchLamp),
    refreshOne(snapshot.fan, fetchFan),
    refreshOne(snapshot.weather, fetchWeather),
    refreshOne(snapshot.events, () => fetchEvents()),
  ]).then(() => {
    lastRefresh = Date.now();
    data.version++;
    inFlight = undefined;
  });
  return inFlight;
}

export function oldestOkAt(): Date | undefined {
  const times = Object.values(snapshot)
    .map((s: Source<unknown>) => s.okAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return times.length ? new Date(Math.min(...times)) : undefined;
}
