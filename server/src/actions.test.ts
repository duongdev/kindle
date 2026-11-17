import assert from "node:assert/strict";
import { test } from "node:test";
import { act, type Device } from "./actions.ts";
import type { Source } from "./model.ts";
import { hapWriteErrors } from "./sources/fan.ts";
import { acPlan } from "./sources/ha.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeDevice(fail = false) {
  const state = { shown: { on: false } };
  const sent: [boolean, boolean][] = [];
  const src: Source<unknown> = {};
  const dev: Device<{ on: boolean }> = {
    key: `test.${Math.random()}`,
    src,
    gapMs: 30,
    get: () => state.shown,
    set: (s) => {
      state.shown = s;
    },
    send: async (want, had) => {
      sent.push([want.on, had.on]);
      await sleep(5);
      if (fail) throw new Error("device said no");
    },
  };
  return { dev, state, sent, src };
}
const flip = (s: { on: boolean }) => ({ on: !s.on });

test("queued taps coalesce: only the state shown at send time goes out, and only if it changed", async () => {
  const { dev, state, sent, src } = fakeDevice();
  act(dev, flip); // sent at once: on
  act(dev, flip); // waits for the gap: off
  act(dev, flip); // replaces it: on again, which the device already confirmed
  await sleep(100);
  assert.deepEqual(sent, [[true, false]]);
  assert.equal(state.shown.on, true);
  assert.ok(Object.keys(src.holds ?? {}).length === 1);
});

test("a failed command shows the last confirmed state again", async () => {
  const { dev, state, sent } = fakeDevice(true);
  act(dev, flip);
  await sleep(50);
  assert.deepEqual(sent, [[true, false]]);
  assert.equal(state.shown.on, false);
});

test("AC plan: every call is absolute and only what changed is sent", () => {
  const off = { mode: "off", setpoint: 26, fanMode: "auto" };
  assert.deepEqual(acPlan({ mode: "cool", setpoint: 27, fanMode: "low" }, off), [
    { service: "set_temperature", data: { temperature: 27, hvac_mode: "cool" } },
    { service: "set_fan_mode", data: { fan_mode: "low" } },
  ]);
  // A setpoint change while on carries the mode, so a dropped "on" tap is not lost.
  assert.deepEqual(acPlan({ mode: "cool", setpoint: 25, fanMode: "low" }, { ...off, mode: "cool", fanMode: "low" }), [
    { service: "set_temperature", data: { temperature: 25, hvac_mode: "cool" } },
  ]);
  assert.deepEqual(acPlan({ ...off }, { mode: "cool", setpoint: 26, fanMode: "auto" }), [
    { service: "set_hvac_mode", data: { hvac_mode: "off" } },
  ]);
  assert.deepEqual(acPlan({ ...off, setpoint: 24 }, off), [{ service: "set_temperature", data: { temperature: 24 } }]);
  assert.deepEqual(acPlan(off, off), []);
});

test("HAP 207 Multi-Status lists the refused characteristics", async () => {
  const multi = new Response(
    JSON.stringify({ characteristics: [{ aid: 2, iid: 10, status: 0 }, { status: -70402 }] }),
    {
      status: 207,
    },
  );
  assert.deepEqual(await hapWriteErrors(multi), [-70402]);
  assert.deepEqual(await hapWriteErrors(new Response(null, { status: 204 })), []);
});
