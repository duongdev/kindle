import assert from "node:assert/strict";
import { test } from "node:test";
import type { Source } from "./model.ts";
import { data, hold, refreshOne } from "./store.ts";

test("the data version only moves when a value or error changes", async () => {
  const src: Source<{ t: number }> = {};
  const v0 = data.version;
  await refreshOne(src, 0, true, async () => ({ t: 1 }));
  assert.equal(data.version, v0 + 1);
  await refreshOne(src, 0, true, async () => ({ t: 1 }));
  assert.equal(data.version, v0 + 1);
  await refreshOne(src, 0, true, async () => ({ t: 2 }));
  assert.equal(data.version, v0 + 2);
});

test("a fetch that started before a tap does not overwrite the shown state", async () => {
  const src: Source<string> = { value: "old" };
  let release = (_: string) => {};
  const p = refreshOne(src, 0, true, () => new Promise<string>((r) => (release = r)));
  src.value = "tapped";
  hold(src, "dev.a", 0); // hold already over, but the write still drops the read
  release("read before tap");
  await p;
  assert.equal(src.value, "tapped");
});

test("a forced refresh fetches again after the one in flight", async () => {
  const src: Source<number> = {};
  let calls = 0;
  const load = async () => ++calls;
  await Promise.all([refreshOne(src, 60_000, false, load), refreshOne(src, 60_000, true, load)]);
  assert.equal(calls, 2);
  assert.equal(src.value, 2);
});

test("holds are per device: one device settling does not end another's hold", async () => {
  const src: Source<string> = { value: "shown" };
  hold(src, "ac.bedroom", 60_000);
  hold(src, "ac.living", 0);
  await refreshOne(src, 0, true, async () => "device");
  assert.equal(src.value, "shown");
});
