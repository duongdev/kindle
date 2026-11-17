import assert from "node:assert/strict";
import { test } from "node:test";
import type { Snapshot } from "./model.ts";
import { agendaScreen } from "./screens/agenda.ts";
import { homeScreen } from "./screens/home.ts";
import { nhaScreen } from "./screens/nha.ts";
import { sleepScreen } from "./screens/sleep.ts";

process.env.TZ = "Asia/Ho_Chi_Minh";

// First load: every source has no value and no error (states.md "Pending").
const empty = (): Snapshot => ({ rooms: {}, lamp: {}, fan: {}, weather: {}, events: {} });
const now = new Date("2026-11-17T10:20:00+07:00");

test("every screen renders the pending copy with an empty snapshot", () => {
  const screens = {
    home: homeScreen(empty(), {}, now),
    sleep: sleepScreen(empty(), {}, now, now),
    agenda: agendaScreen(empty(), {}, now),
    nha: nhaScreen(empty(), {}, now),
  };
  for (const [name, html] of Object.entries(screens)) {
    assert.match(html, /dashed/, name);
    if (name !== "nha") assert.match(html, /Đang tải lịch…/, name);
    if (name === "home" || name === "sleep") assert.match(html, /Đang tải thời tiết…/, name);
    if (name !== "agenda") assert.match(html, /Đang tải…/, name);
    assert.doesNotMatch(html, /data-action="(ac|lamp|fan)\./, name);
  }
});

test("a failed source with no cache shows its message, not pending", () => {
  const snap = empty();
  snap.events.error = "CALENDARS is not set";
  snap.rooms.error = "HA_URL or HA_TOKEN is not set";
  assert.match(agendaScreen(snap, {}, now), /Chưa kết nối lịch/);
  assert.doesNotMatch(agendaScreen(snap, {}, now), /Đang tải lịch…/);
  assert.match(homeScreen(snap, {}, now), /Chưa kết nối lịch/);
  assert.match(nhaScreen(snap, {}, now), /Chưa kết nối Home Assistant/);
});
