import { config, env } from "../config.ts";
import type { DeviceState } from "../model.ts";
import { fixture, getJson, send } from "./http.ts";

interface Accessory {
  uniqueId: string;
  serviceCharacteristics: { type: string; value: unknown }[];
}

let token: { value: string; until: number } | undefined;

async function login(): Promise<Record<string, string>> {
  if (!env.hbUrl || !env.hbUser || !env.hbPass) throw new Error("HB_URL, HB_USER or HB_PASS is not set");
  if (!token || Date.now() > token.until) {
    const res = await send("POST", `${env.hbUrl}/api/auth/login`, { username: env.hbUser, password: env.hbPass });
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, until: Date.now() + (body.expires_in - 300) * 1000 };
  }
  return { Authorization: `Bearer ${token.value}` };
}

function char(a: Accessory, type: string): unknown {
  return a.serviceCharacteristics.find((c) => c.type === type)?.value;
}

export async function fetchLamp(): Promise<DeviceState> {
  const lamp = config.lamp;
  if (!lamp) throw new Error("no lamp in config");
  const list = env.fixtures
    ? fixture<Accessory[]>("homebridge.json")
    : await getJson<Accessory[]>(`${env.hbUrl}/api/accessories`, await login());
  const a = list.find((x) => x.uniqueId === lamp.homebridgeUniqueId);
  if (!a) return { name: lamp.name, reachable: false };
  const on = Boolean(char(a, "On"));
  return { name: lamp.name, reachable: true, on, detail: on ? `${char(a, "Brightness")}%` : undefined };
}

export async function lampToggle(currentlyOn: boolean) {
  const lamp = config.lamp;
  if (!lamp) throw new Error("no lamp in config");
  const url = `${env.hbUrl}/api/accessories/${lamp.homebridgeUniqueId}`;
  const headers = await login();
  if (!currentlyOn) {
    await send("PUT", url, { characteristicType: "Brightness", value: lamp.onBrightness }, headers);
  }
  await send("PUT", url, { characteristicType: "On", value: !currentlyOn }, headers);
}

// The fan's child bridge is not in /api/accessories; writes to its HAP server need the bridge PIN.
export async function childBridgePin(identifier: string): Promise<string> {
  const bridges = await getJson<{ identifier: string; pin: string }[]>(
    `${env.hbUrl}/api/status/homebridge/child-bridges`,
    await login(),
  );
  const pin = bridges.find((b) => b.identifier === identifier)?.pin;
  if (!pin) throw new Error(`no child bridge ${identifier}`);
  return pin;
}
