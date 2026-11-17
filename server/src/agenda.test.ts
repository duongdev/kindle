import assert from "node:assert/strict";
import { test } from "node:test";
import { agendaDay, homeAgenda } from "./agenda.ts";
import type { CalEvent } from "./model.ts";

process.env.TZ = "Asia/Ho_Chi_Minh";

const at = (hm: string, day = 17) => new Date(`2026-11-${day}T${hm}:00+07:00`);
const ev = (title: string, start: string, end: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  calendar: "Work",
  title,
  start: at(start),
  end: at(end),
  allDay: false,
  tentative: false,
  ...extra,
});
const allDay = (title: string, from: number, to: number): CalEvent => ({
  calendar: "Work",
  title,
  start: new Date(`2026-11-${from}T00:00:00+07:00`),
  end: new Date(`2026-11-${to}T00:00:00+07:00`),
  allDay: true,
  tentative: false,
});

test("next event, rows and +N for many events", () => {
  const events = [
    ev("Done", "08:00", "08:30"),
    ev("A", "11:00", "11:30"),
    ev("B", "12:00", "12:30"),
    ev("C", "13:00", "13:30"),
    ev("D", "14:00", "14:30"),
    ev("E", "15:00", "15:30"),
  ];
  const a = homeAgenda(events, at("10:20"));
  assert.equal(a.header, "còn 5 sự kiện · 1 đã qua");
  assert.equal(a.next?.event.title, "A");
  assert.deepEqual(
    a.rows.map((r) => r.text),
    ["B", "C"],
  );
  assert.equal(a.rows[1].more, 2);
});

test("all-day events merge into one row; cancelled titles hide", () => {
  const events = [
    allDay("Leave", 17, 18),
    allDay("Report", 16, 19),
    allDay("Holiday", 17, 18),
    ev("Canceled: Sync", "11:00", "11:30"),
    ev("Standup", "11:00", "11:15", { tentative: true }),
  ];
  const a = homeAgenda(events, at("10:20"));
  assert.equal(a.rows[0].time, "Cả ngày");
  assert.equal(a.rows[0].text, "Leave · Report · +1");
  assert.equal(a.next?.event.title, "Standup");
  assert.equal(a.header, "còn 1 sự kiện · 0 đã qua");
});

test("in-progress event stays as next; empty day says so", () => {
  const a = homeAgenda([ev("Call", "10:00", "11:00")], at("10:20"));
  assert.equal(a.next?.inProgress, true);
  assert.equal(
    homeAgenda([ev("Later", "09:00", "09:30", { start: at("09:00", 18), end: at("09:30", 18) })], at("10:20")).empty,
    "Hôm nay trống",
  );
  assert.equal(homeAgenda([], at("10:20")).empty, "Không có sự kiện");
});

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

test("agenda day: 8 events drop past first, then +N with the hidden span", () => {
  const events = [
    ev("P1", "08:00", "08:30"),
    ev("P2", "09:00", "09:30"),
    ev("A", "11:00", "11:30"),
    ev("B", "12:00", "12:30"),
    ev("C", "13:00", "13:30"),
    ev("D", "14:00", "14:30"),
    ev("E", "15:00", "15:30"),
    ev("F", "16:00", "16:30"),
  ];
  const rows = agendaDay(events, at("00:00"), at("10:20"));
  assert.equal(rows.length, 5);
  assert.deepEqual(titles(rows), ["A", "B", "C", "D", "+2 sự kiện (15:00–16:30)"]);
  assert.equal(rows[0].next, true);
  assert.equal(rows[0].tag, "40 phút nữa");
  assert.equal(rows[1].tag, "Work");
  assert.equal(rows[4].more, true);
});

test("agenda day: only as many past events drop as needed, struck rows stay", () => {
  const events = [
    ev("P1", "07:00", "07:30"),
    ev("P2", "08:00", "08:30"),
    ev("P3", "09:00", "09:30"),
    ev("A", "11:00", "11:30"),
    ev("B", "12:00", "12:30"),
    ev("C", "13:00", "13:30"),
  ];
  const rows = agendaDay(events, at("00:00"), at("10:20"));
  assert.deepEqual(titles(rows), ["P2", "P3", "A", "B", "C"]);
  assert.deepEqual(
    rows.map((r) => Boolean(r.past)),
    [true, true, false, false, false],
  );
  assert.equal(rows.filter((r) => r.next).length, 1);
});

test("agenda day: no events gives no rows", () => {
  assert.deepEqual(agendaDay([], at("00:00", 18), at("10:20")), []);
});

test("agenda day: multi-day all-day event tags the day number and comes first", () => {
  const events = [
    ev("Sync", "09:00", "09:30", { start: at("09:00", 18), end: at("09:30", 18) }),
    allDay("Trip", 17, 20),
  ];
  const day2 = agendaDay(events, at("00:00", 18), at("10:20"));
  assert.deepEqual(titles(day2), ["Trip", "Sync"]);
  assert.equal(day2[0].time, "Cả ngày");
  assert.equal(day2[0].tag, "ngày 2/3");
  assert.equal(day2[1].next, false);
  assert.equal(agendaDay(events, at("00:00", 19), at("10:20"))[0].tag, "ngày 3/3");
  assert.deepEqual(agendaDay(events, at("00:00", 20), at("10:20")), []);
});

test("agenda day: overlapping events sort by start, then end; tentative gets ?", () => {
  const events = [
    ev("Long", "09:15", "10:00"),
    ev("Short", "09:15", "09:30", { tentative: true }),
    ev("First", "09:00", "09:30"),
  ];
  const rows = agendaDay(events, at("00:00"), at("08:00"));
  assert.deepEqual(titles(rows), ["First", "? Short", "Long"]);
  assert.equal(rows[1].time, "09:15–09:30");
});

test("overnight and multi-day timed events show on every day they cover, with times cut to the day", () => {
  const overnight = ev("Deploy", "23:00", "01:00", { start: at("23:00", 16), end: at("01:00", 17) });
  const conf = ev("Conf", "09:00", "17:00", { start: at("09:00", 17), end: at("17:00", 19) });
  const events = [overnight, conf];

  const today = agendaDay(events, at("00:00"), at("00:30"));
  assert.deepEqual(titles(today), ["Deploy", "Conf"]);
  assert.equal(today[0].time, "00:00–01:00");
  assert.equal(today[0].next, true);
  assert.equal(today[1].time, "09:00–24:00");

  const middle = agendaDay(events, at("00:00", 18), at("00:30"));
  assert.deepEqual(titles(middle), ["Conf"]);
  assert.equal(middle[0].time, "00:00–24:00");
  assert.equal(agendaDay(events, at("00:00", 19), at("00:30"))[0].time, "00:00–17:00");
  assert.deepEqual(agendaDay(events, at("00:00", 20), at("00:30")), []);

  const home = homeAgenda(events, at("00:30"));
  assert.equal(home.next?.event.title, "Deploy");
  assert.equal(home.next?.inProgress, true);
  assert.equal(home.rows[0].time, "09:00");
  assert.equal(homeAgenda(events, at("10:00", 18)).next?.event.title, "Conf");
});

test("an event ending at midnight does not spill into the next day", () => {
  const late = ev("Late", "22:00", "00:00", { start: at("22:00", 17), end: at("00:00", 18) });
  assert.deepEqual(agendaDay([late], at("00:00", 18), at("10:00")), []);
  assert.equal(agendaDay([late], at("00:00"), at("10:00"))[0].time, "22:00–24:00");
});
