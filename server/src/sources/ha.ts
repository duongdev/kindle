import { config, env } from "../config.ts";
import type { RoomState } from "../model.ts";
import { fixture, getJson, num, send } from "./http.ts";

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

function auth() {
  if (!env.haUrl || !env.haToken) throw new Error("HA_URL or HA_TOKEN is not set");
  return { url: env.haUrl, headers: { Authorization: `Bearer ${env.haToken}` } };
}

async function states(): Promise<Map<string, HAState>> {
  let list: HAState[];
  if (env.fixtures) {
    // The snapshot flattens attributes next to entity_id and state.
    list = fixture<Record<string, unknown>[]>("ha-states.json").map(({ entity_id, state, ...attributes }) => ({
      entity_id: String(entity_id),
      state: String(state),
      attributes,
    }));
  } else {
    const { url, headers } = auth();
    list = await getJson<HAState[]>(`${url}/api/states`, headers);
  }
  return new Map(list.map((s) => [s.entity_id, s]));
}

export async function fetchRooms(): Promise<RoomState[]> {
  const byId = await states();
  return config.rooms.map((r) => {
    const climate = r.climate ? byId.get(r.climate) : undefined;
    const usable = climate && climate.state !== "unavailable" && climate.state !== "unknown";
    return {
      key: r.key,
      name: r.name,
      tempC: r.temperature ? num(byId.get(r.temperature)?.state, 0, 60) : undefined,
      humidity: r.humidity ? num(byId.get(r.humidity)?.state, 0, 100) : undefined,
      ac: usable
        ? {
            mode: climate.state,
            setpoint: num(climate.attributes.temperature),
            fanMode: climate.attributes.fan_mode as string | undefined,
          }
        : undefined,
    };
  });
}

async function callService(domain: string, service: string, data: Record<string, unknown>) {
  const { url, headers } = auth();
  await send("POST", `${url}/api/services/${domain}/${service}`, data, headers);
}

export async function acToggle(roomKey: string, currentlyOn: boolean) {
  const entity_id = config.rooms.find((r) => r.key === roomKey)?.climate;
  if (!entity_id) throw new Error(`no AC for room ${roomKey}`);
  if (currentlyOn) return callService("climate", "set_hvac_mode", { entity_id, hvac_mode: "off" });
  const p = config.acPreset;
  await callService("climate", "set_temperature", { entity_id, temperature: p.temperature, hvac_mode: p.hvac });
  await callService("climate", "set_fan_mode", { entity_id, fan_mode: p.fan });
}

export async function acSetpoint(roomKey: string, setpoint: number) {
  const entity_id = config.rooms.find((r) => r.key === roomKey)?.climate;
  if (!entity_id) throw new Error(`no AC for room ${roomKey}`);
  await callService("climate", "set_temperature", { entity_id, temperature: setpoint });
}
