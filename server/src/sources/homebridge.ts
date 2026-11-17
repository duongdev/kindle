import { config, env } from "../config.ts";
import type { DeviceState } from "../model.ts";
import { fixture, getJson, HttpError, send } from "./http.ts";

interface Accessory {
  uniqueId: string;
  serviceCharacteristics: { type: string; value: unknown }[];
}

let token: { value: string; until: number } | undefined;

async function login(): Promise<Record<string, string>> {
  if (!env.hbUrl || !env.hbUser || !env.hbPass) throw new Error("HB_URL, HB_USER or HB_PASS is not set");
  if (!token || Date.now() > token.until) {
    const res = await send("POST", `${env.hbUrl}/api/auth/login`, { username: env.hbUser, password: env.hbPass });
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string") throw new Error("Homebridge login gave no token");
    const ttl = typeof body.expires_in === "number" ? body.expires_in : 3600;
    token = { value: body.access_token, until: Date.now() + Math.max(60, ttl - 300) * 1000 };
  }
  return { Authorization: `Bearer ${token.value}` };
}

// Runs `call` with a token; a 401 (token revoked, UI secret reset) drops the token and tries once more.
async function authed<T>(call: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  try {
    return await call(await login());
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 401)) throw e;
    token = undefined;
    return call(await login());
  }
}

function char(a: Accessory, type: string): unknown {
  return a.serviceCharacteristics.find((c) => c.type === type)?.value;
}

export async function fetchLamp(): Promise<DeviceState> {
  const lamp = config.lamp;
  if (!lamp) throw new Error("no lamp in config");
  const list = env.fixtures
    ? fixture<Accessory[]>("homebridge.json")
    : await authed((h) => getJson<Accessory[]>(`${env.hbUrl}/api/accessories`, h));
  const a = list.find((x) => x.uniqueId === lamp.homebridgeUniqueId);
  if (!a) return { name: lamp.name, reachable: false };
  const on = Boolean(char(a, "On"));
  return { name: lamp.name, reachable: true, on, detail: on ? `${char(a, "Brightness")}%` : undefined };
}

// On sets the owner's preset brightness first.
export async function lampSet(on: boolean) {
  const lamp = config.lamp;
  if (!lamp) throw new Error("no lamp in config");
  const url = `${env.hbUrl}/api/accessories/${lamp.homebridgeUniqueId}`;
  await authed(async (headers) => {
    if (on) await send("PUT", url, { characteristicType: "Brightness", value: lamp.onBrightness }, headers);
    await send("PUT", url, { characteristicType: "On", value: on }, headers);
  });
}

// The fan's child bridge is not in /api/accessories; writes to its HAP server need the bridge PIN.
export async function childBridgePin(identifier: string): Promise<string> {
  const bridges = await authed((h) =>
    getJson<{ identifier: string; pin: string }[]>(`${env.hbUrl}/api/status/homebridge/child-bridges`, h),
  );
  const pin = bridges.find((b) => b.identifier === identifier)?.pin;
  if (!pin) throw new Error(`no child bridge ${identifier}`);
  return pin;
}
