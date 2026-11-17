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

// The ACs are IR: every service call is one IR burst, and the blaster drops a burst sent right after another.
const IR_GAP_MS = 2_000;

export type AcState = NonNullable<RoomState["ac"]>;

// The fewest service calls that take the AC from `had` (last state the device confirmed) to `want`.
// Every call sets absolute values, so a later call never depends on an earlier one being sent.
export function acPlan(want: AcState, had: AcState): { service: string; data: Record<string, unknown> }[] {
  if (want.mode === "off") {
    if (had.mode !== "off") return [{ service: "set_hvac_mode", data: { hvac_mode: "off" } }];
    // Off stays off: HA only stores a new setpoint, no IR is sent.
    return want.setpoint !== undefined && want.setpoint !== had.setpoint
      ? [{ service: "set_temperature", data: { temperature: want.setpoint } }]
      : [];
  }
  const calls = [];
  if (want.mode !== had.mode || want.setpoint !== had.setpoint) {
    calls.push(
      want.setpoint === undefined
        ? { service: "set_hvac_mode", data: { hvac_mode: want.mode } }
        : { service: "set_temperature", data: { temperature: want.setpoint, hvac_mode: want.mode } },
    );
  }
  if (want.fanMode && want.fanMode !== had.fanMode)
    calls.push({ service: "set_fan_mode", data: { fan_mode: want.fanMode } });
  return calls;
}

export async function acApply(roomKey: string, want: AcState, had: AcState) {
  const entity_id = config.rooms.find((r) => r.key === roomKey)?.climate;
  if (!entity_id) throw new Error(`no AC for room ${roomKey}`);
  for (const [i, c] of acPlan(want, had).entries()) {
    if (i) await new Promise((r) => setTimeout(r, IR_GAP_MS));
    await callService("climate", c.service, { entity_id, ...c.data });
  }
}
