// Action ids from docs/design/interaction.md. A tap changes the shown (cached) state at once, then a
// per-device queue makes the real device match it. The IR ACs and the Xiaomi fan drop a command that
// comes right after the previous one, so commands are spaced out. When taps pile up, the queue sends
// only the state shown when the command goes out, compared with the last state the device confirmed.
import { config } from "./config.ts";
import type { DeviceState, Source } from "./model.ts";
import { fanSet } from "./sources/fan.ts";
import { type AcState, acApply } from "./sources/ha.ts";
import { lampSet } from "./sources/homebridge.ts";
import { data, hold, refresh, snapshot } from "./store.ts";

export interface Device<S> {
  key: string;
  src: Source<unknown>;
  gapMs: number;
  get: () => S | undefined;
  set: (s: S) => void;
  // Makes the device match `want`; `had` is the last state the device confirmed.
  send: (want: S, had: S) => Promise<unknown>;
}

interface Queue {
  running: boolean;
  dirty: boolean;
  lastAt: number;
  had?: unknown;
}

const queues = new Map<string, Queue>();
// Refreshes keep the shown state this long while a command waits, and a little after the last one is sent
// (a device read right after a write can still return the old state).
const HOLD_MS = 60_000;
const SETTLE_MS = 4_000;

export function act<S>(dev: Device<S>, change: (cur: S) => S) {
  const cur = dev.get();
  if (cur === undefined) throw new Error(`state unknown for ${dev.key}`);
  const next = change(cur);
  const q = queues.get(dev.key) ?? { running: false, dirty: false, lastAt: 0 };
  queues.set(dev.key, q);
  // An idle queue has sent everything, so the shown state is what the device last confirmed.
  if (!q.running) q.had = cur;
  dev.set(next);
  data.version++;
  hold(dev.src, dev.key, HOLD_MS);
  q.dirty = true;
  if (!q.running) void drain(dev, q);
}

async function drain<S>(dev: Device<S>, q: Queue) {
  q.running = true;
  while (q.dirty) {
    const wait = q.lastAt + dev.gapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    q.dirty = false;
    const want = dev.get();
    const had = q.had as S;
    if (want === undefined || JSON.stringify(want) === JSON.stringify(had)) continue;
    try {
      await dev.send(want, had);
      q.had = want;
    } catch (e) {
      console.error("action failed:", dev.key, e instanceof Error ? e.message : e);
      // A newer tap already set the shown state and is sent next; otherwise show the confirmed state again.
      if (!q.dirty) {
        dev.set(had);
        data.version++;
      }
    }
    q.lastAt = Date.now();
  }
  q.running = false;
  hold(dev.src, dev.key, SETTLE_MS);
  setTimeout(() => void refresh(true), SETTLE_MS + 1_000).unref();
}

const room = (key: string) => snapshot.rooms.value?.find((r) => r.key === key);

const acDevice = (key: string): Device<AcState> => ({
  key: `ac.${key}`,
  src: snapshot.rooms,
  gapMs: 3_000,
  get: () => room(key)?.ac,
  set: (s) => {
    const r = room(key);
    if (r) r.ac = s;
  },
  send: (want, had) => acApply(key, want, had),
});

const switchDevice = (
  key: string,
  src: Source<DeviceState>,
  gapMs: number,
  set: (on: boolean) => Promise<unknown>,
): Device<DeviceState> => ({
  key,
  src,
  gapMs,
  get: () => src.value,
  set: (s) => {
    src.value = s;
  },
  send: async (want, had) => {
    if (Boolean(want.on) !== Boolean(had.on)) await set(Boolean(want.on));
  },
});

export function runAction(id: string) {
  const [kind, target, ...rest] = id.split(".");
  const op = rest.join(".");
  if (kind === "ac" && op === "toggle") {
    const p = config.acPreset;
    return act(acDevice(target), (ac) =>
      ac.mode !== "off" ? { ...ac, mode: "off" } : { mode: p.hvac, setpoint: p.temperature, fanMode: p.fan },
    );
  }
  if (kind === "ac" && (op === "temp.up" || op === "temp.down")) {
    return act(acDevice(target), (ac) => {
      if (ac.setpoint === undefined) throw new Error(`setpoint unknown for ${target}`);
      return { ...ac, setpoint: ac.setpoint + (op === "temp.up" ? 1 : -1) };
    });
  }
  if (id === "lamp.bedroom.toggle") {
    return act(switchDevice("lamp.bedroom", snapshot.lamp, 500, lampSet), (l) => ({
      ...l,
      on: !l.on,
      detail: l.on ? undefined : `${config.lamp?.onBrightness}%`,
    }));
  }
  if (id === "fan.bedroom.toggle") {
    return act(switchDevice("fan.bedroom", snapshot.fan, 2_000, fanSet), (f) => ({
      ...f,
      on: !f.on,
      detail: f.on ? undefined : "số 2",
    }));
  }
  throw new Error(`unknown action ${id}`);
}
