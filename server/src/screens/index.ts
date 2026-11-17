import { config } from "../config.ts";
import type { ClientInfo } from "../model.ts";
import { render } from "../render.ts";
import { data, refresh, snapshot } from "../store.ts";
import { hhmm } from "../vi.ts";
import { agendaScreen } from "./agenda.ts";
import { homeScreen } from "./home.ts";
import { nhaScreen } from "./nha.ts";
import { sleepScreen } from "./sleep.ts";

export const SCREENS = ["sleep", "home", "agenda", "nha"] as const;
export type ScreenName = (typeof SCREENS)[number];

// Screens only change when the data or the minute changes; the Kindle asks often (prefetch, swipes).
const cache = new Map<string, Promise<Awaited<ReturnType<typeof render>>>>();

export async function renderScreen(name: ScreenName, client: ClientInfo, now = new Date()) {
  await refresh();
  const key = JSON.stringify([name, client, hhmm(now), data.version]);
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 32) cache.clear();
    hit = draw(name, client, now);
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

async function draw(name: ScreenName, client: ClientInfo, now: Date) {
  const nextAt = client.nextAt ?? new Date(now.getTime() + config.sleepIntervalMin * 60_000);
  const html =
    name === "home"
      ? homeScreen(snapshot, client, now)
      : name === "agenda"
        ? agendaScreen(snapshot, client, now)
        : name === "nha"
          ? nhaScreen(snapshot, client, now)
          : sleepScreen(snapshot, client, now, nextAt);
  return render(html);
}
