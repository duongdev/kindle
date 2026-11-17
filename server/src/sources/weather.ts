import { config, env } from "../config.ts";
import type { Weather } from "../model.ts";
import { fixture, getJson } from "./http.ts";

interface OpenMeteo {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

export async function fetchWeather(): Promise<Weather> {
  const { lat, lon } = config.location;
  const url =
    `http://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,weather_code" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    `&timezone=${encodeURIComponent(config.timezone)}&forecast_days=2`;
  const d = env.fixtures ? fixture<OpenMeteo>("weather.json") : await getJson<OpenMeteo>(url);
  return {
    tempC: d.current.temperature_2m,
    apparentC: d.current.apparent_temperature,
    code: d.current.weather_code,
    highC: d.daily.temperature_2m_max[0],
    lowC: d.daily.temperature_2m_min[0],
    // Times come in the configured time zone, which is also the process time zone.
    hourly: d.hourly.time.map((t, i) => ({
      time: new Date(t),
      tempC: d.hourly.temperature_2m[i],
      rainPct: d.hourly.precipitation_probability[i] ?? 0,
      code: d.hourly.weather_code[i],
    })),
  };
}
