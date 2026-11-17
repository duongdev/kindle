import assert from "node:assert/strict";
import { test } from "node:test";
import { feelsLikeC } from "./feels.ts";
import { solarToLunar } from "./lunar.ts";

test("lunar date matches known days", () => {
  assert.deepEqual(solarToLunar(17, 11, 2026), { day: 9, month: 10, year: 2026, leap: false });
  assert.deepEqual(solarToLunar(17, 2, 2026), { day: 1, month: 1, year: 2026, leap: false });
  assert.deepEqual(solarToLunar(29, 1, 2025), { day: 1, month: 1, year: 2025, leap: false });
  // 2025 has a leap 6th month starting 2025-07-25.
  assert.deepEqual(solarToLunar(25, 7, 2025), { day: 1, month: 6, year: 2025, leap: true });
});

test("feels-like follows the NOAA heat index", () => {
  assert.equal(Math.round(feelsLikeC(29.5, 75)), 35);
  assert.equal(Math.round(feelsLikeC(22, 50)), 22);
});
