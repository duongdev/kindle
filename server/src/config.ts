import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RoomConfig {
  key: string;
  name: string;
  climate?: string;
  temperature?: string;
  humidity?: string;
}

export interface Config {
  timezone: string;
  location: { lat: number; lon: number };
  sleepIntervalMin: number;
  rooms: RoomConfig[];
  lamp?: { name: string; homebridgeUniqueId: string; onBrightness: number };
  fan?: {
    name: string;
    childBridge: string;
    url: string;
    aid: number;
    iids: { active: number; swing: number; low: number; mid: number; high: number };
  };
  acPreset: { hvac: string; temperature: number; fan: string };
  hiddenCalendars: string[];
}

const root = resolve(import.meta.dirname, "..");

// CONFIG_JSON (the file content) suits a Portainer stack; CONFIG (a path) suits local runs.
export const config: Config = JSON.parse(
  process.env.CONFIG_JSON ?? readFileSync(resolve(root, process.env.CONFIG ?? "config.example.json"), "utf8"),
);

export const env = {
  port: Number(process.env.PORT ?? 8080),
  fixtures: process.env.FIXTURES ? resolve(root, process.env.FIXTURES) : undefined,
  haUrl: process.env.HA_URL,
  haToken: process.env.HA_TOKEN,
  hbUrl: process.env.HB_URL,
  hbUser: process.env.HB_USER,
  hbPass: process.env.HB_PASS,
  // "Name|https://...ics;Name 2|https://...ics". Secret iCal addresses stay in the environment.
  calendars: (process.env.CALENDARS ?? "")
    .split(";")
    .filter(Boolean)
    .map((s) => {
      const [name, url] = s.split("|");
      return { name, url };
    }),
};
