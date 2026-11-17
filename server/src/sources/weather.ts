import { config, env } from "../config.ts";
import type { Weather } from "../model.ts";
import { fixture, getJson, num } from "./http.ts";

interface OpenMeteo {
  current?: { temperature_2m?: unknown; apparent_temperature?: unknown; weather_code?: unknown };
  hourly?: { time?: unknown[]; temperature_2m?: unknown; precipitation_probability?: unknown; weather_code?: unknown };
  daily?: { temperature_2m_max?: unknown; temperature_2m_min?: unknown };
}

export async function fetchWeather(): Promise<Weather> {
  const { lat, lon } = config.location;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,weather_code" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    `&timezone=${encodeURIComponent(config.timezone)}&forecast_days=2`;
  const d = env.fixtures ? fixture<OpenMeteo>("weather.json") : await getJson<OpenMeteo>(url);
  // Values go into the rendered HTML, so force them to plain numbers; a missing value stays undefined.
  const at = (list: unknown, i: number) => (Array.isArray(list) ? num(list[i]) : undefined);
  const pct = (v: number | undefined) => (v === undefined ? undefined : Math.round(Math.min(100, Math.max(0, v))));
  return {
    tempC: num(d.current?.temperature_2m),
    apparentC: num(d.current?.apparent_temperature),
    code: num(d.current?.weather_code),
    highC: at(d.daily?.temperature_2m_max, 0),
    lowC: at(d.daily?.temperature_2m_min, 0),
    // Times come in the configured time zone, which is also the process time zone.
    hourly: (d.hourly?.time ?? [])
      .map((t, i) => ({
        time: new Date(String(t)),
        tempC: at(d.hourly?.temperature_2m, i),
        rainPct: pct(at(d.hourly?.precipitation_probability, i)),
        code: at(d.hourly?.weather_code, i),
      }))
      .filter((h) => !Number.isNaN(h.time.getTime())),
  };
}
