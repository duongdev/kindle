import { config, env } from "../config.ts";
import type { DeviceState } from "../model.ts";
import { childBridgePin } from "./homebridge.ts";
import { fixture, getJson, send } from "./http.ts";

interface HapChar {
  aid: number;
  iid: number;
  value: unknown;
}

let pin: string | undefined;

function fanConfig() {
  if (!config.fan) throw new Error("no fan in config");
  return config.fan;
}

async function read(): Promise<Map<number, unknown>> {
  const fan = fanConfig();
  if (env.fixtures) {
    const doc = fixture<{ accessories: { aid: number; services: { characteristics: HapChar[] }[] }[] }>("fan-hap.json");
    const acc = doc.accessories.find((a) => a.aid === fan.aid);
    return new Map(acc?.services.flatMap((s) => s.characteristics).map((c) => [c.iid, c.value]) ?? []);
  }
  const ids = Object.values(fan.iids)
    .map((iid) => `${fan.aid}.${iid}`)
    .join(",");
  const res = await getJson<{ characteristics: HapChar[] }>(`${fan.url}/characteristics?id=${ids}`, {}, 5_000);
  return new Map(res.characteristics.map((c) => [c.iid, c.value]));
}

export async function fetchFan(): Promise<DeviceState> {
  const fan = fanConfig();
  const v = await read();
  const on = Boolean(v.get(fan.iids.active));
  const speed = v.get(fan.iids.high) ? 3 : v.get(fan.iids.mid) ? 2 : v.get(fan.iids.low) ? 1 : undefined;
  return { name: fan.name, reachable: true, on, detail: on ? `số ${speed ?? "?"}` : undefined };
}

// Owner's preset: ON = Mid speed, no swing.
export async function fanToggle(currentlyOn: boolean) {
  const fan = fanConfig();
  pin ??= await childBridgePin(fan.childBridge);
  const c = (iid: number, value: unknown) => ({ aid: fan.aid, iid, value });
  const characteristics = currentlyOn
    ? [c(fan.iids.active, 0)]
    : [c(fan.iids.active, 1), c(fan.iids.swing, 0), c(fan.iids.mid, true)];
  await send("PUT", `${fan.url}/characteristics`, { characteristics }, { Authorization: pin }, 5_000);
}
