import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config, env } from "./config.ts";
import type { ClientInfo } from "./model.ts";
import { toFramebuffer } from "./render.ts";
import { renderScreen, SCREENS, type ScreenName } from "./screens/index.ts";
import { fanToggle } from "./sources/fan.ts";
import { acSetpoint, acToggle } from "./sources/ha.ts";
import { lampToggle } from "./sources/homebridge.ts";
import { data, refresh, snapshot } from "./store.ts";

process.env.TZ = config.timezone;

function clientInfo(q: URLSearchParams): ClientInfo {
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const next = n("next");
  return {
    battery: n("batt"),
    charging: q.get("charging") === "1",
    wifi: q.get("wifi") === "1",
    nextAt: next ? new Date(next * 1000) : undefined,
  };
}

// Action ids from docs/design/interaction.md. Each reads the cached state to decide the toggle direction,
// then updates the cache at once: a device read right after a write can still return the old state.
// The Xiaomi fan (and IR ACs) drop a command that comes a second or two after the last one.
const COOLDOWN_MS = 5_000;
const lastAction = new Map<string, number>();

async function runAction(id: string) {
  const [kind, target, ...rest] = id.split(".");
  const device = `${kind}.${target}`;
  if (Date.now() - (lastAction.get(device) ?? 0) < COOLDOWN_MS) throw new Busy(device);
  lastAction.set(device, Date.now());
  if (kind === "ac") {
    const room = snapshot.rooms.value?.find((r) => r.key === target);
    if (!room?.ac) throw new Error(`AC state unknown for ${target}`);
    if (rest[0] === "toggle") {
      const on = room.ac.mode !== "off";
      await acToggle(target, on);
      const p = config.acPreset;
      room.ac = on ? { ...room.ac, mode: "off" } : { mode: p.hvac, setpoint: p.temperature, fanMode: p.fan };
      return;
    }
    const step = rest.join(".") === "temp.up" ? 1 : rest.join(".") === "temp.down" ? -1 : 0;
    if (!step || room.ac.setpoint === undefined) throw new Error(`bad action ${id}`);
    await acSetpoint(target, room.ac.setpoint + step);
    room.ac.setpoint += step;
    return;
  }
  if (id === "lamp.bedroom.toggle" && snapshot.lamp.value) {
    const lamp = snapshot.lamp.value;
    await lampToggle(Boolean(lamp.on));
    snapshot.lamp.value = {
      ...lamp,
      on: !lamp.on,
      detail: lamp.on ? undefined : `${config.lamp?.onBrightness}%`,
    };
    return;
  }
  if (id === "fan.bedroom.toggle" && snapshot.fan.value) {
    const fan = snapshot.fan.value;
    await fanToggle(Boolean(fan.on));
    snapshot.fan.value = { ...fan, on: !fan.on, detail: fan.on ? undefined : "số 2" };
    return;
  }
  if (id === "sync.now") return refresh(0);
  throw new Error(`unknown action ${id}`);
}

class Busy extends Error {
  constructor(device: string) {
    super(`${device} is busy, try again in a few seconds`);
  }
}

function reply(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const screen = url.pathname.match(/^\/screen\/([a-z]+)\.(png|json|raw)$/);
  if (req.method === "GET" && screen && SCREENS.includes(screen[1] as ScreenName)) {
    const { png, regions } = await renderScreen(screen[1] as ScreenName, clientInfo(url.searchParams));
    if (screen[2] === "png") return reply(res, 200, "image/png", png);
    if (screen[2] === "raw") return reply(res, 200, "application/octet-stream", await toFramebuffer(png));
    return reply(res, 200, "application/json", JSON.stringify({ width: 1264, height: 1680, regions }));
  }
  const action = url.pathname.match(/^\/action\/([a-z0-9.]+)$/);
  if (req.method === "POST" && action) {
    if (env.fixtures) return reply(res, 409, "text/plain", "actions are off in fixture mode\n");
    await refresh();
    await runAction(action[1]);
    data.version++;
    setTimeout(() => refresh(0), 5_000);
    return reply(res, 204, "text/plain", "");
  }
  if (url.pathname === "/healthz") {
    const sources = Object.fromEntries(Object.entries(snapshot).map(([k, s]) => [k, { okAt: s.okAt, error: s.error }]));
    return reply(res, 200, "application/json", JSON.stringify({ ok: true, fixtures: Boolean(env.fixtures), sources }));
  }
  reply(res, 404, "text/plain", "not found\n");
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (e instanceof Busy) return reply(res, 429, "text/plain", `${e.message}\n`);
    console.error(req.method, req.url, e);
    reply(res, 500, "text/plain", `${e instanceof Error ? e.message : e}\n`);
  });
}).listen(env.port, () => console.log(`dashboard server on :${env.port}${env.fixtures ? " (fixtures)" : ""}`));
