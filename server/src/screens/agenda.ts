// Agenda, three days (docs/design/screens.md section 2, canvas board "Agenda").
import { type AgendaRow, agendaDay, DAY_SLOTS } from "../agenda.ts";
import type { ClientInfo, Snapshot } from "../model.ts";
import { esc, hhmm, lunarDate, weekday } from "../vi.ts";
import { ELL, footerDots, oldestOk, page, pending, statusZone } from "./parts.ts";

const ROW =
  "height: 76px; box-sizing: border-box; display: grid; grid-template-columns: 230px minmax(0, 1fr) 140px; gap: 24px; align-items: center";
const BLANK = '<div style="height: 76px" aria-hidden="true"></div>';
const DASH = "height: 32px; border: 2px dashed #000000; box-sizing: border-box";

function row(r: AgendaRow, last: boolean): string {
  if (r.more) {
    return `<div style="height: 76px; box-sizing: border-box; display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 24px; align-items: center"><span></span><span style="font-size: 32px; font-weight: 700; ${ELL}">${esc(r.title)}</span></div>`;
  }
  if (r.next) {
    return `<div style="${ROW}; background: #000000; color: #ffffff; padding: 0 20px; margin: 0 -20px"><span style="font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; ${ELL}">${esc(r.time)}</span><span style="font-size: 34px; font-weight: 600; ${ELL}">${esc(r.title)}</span><span style="font-size: 26px; font-weight: 600; text-align: right; ${ELL}">${esc(r.tag)}</span></div>`;
  }
  const border = last ? "" : "; border-bottom: 1px solid #000000";
  const past = r.past ? "; color: #333333; text-decoration: line-through" : "";
  return `<div style="${ROW}${border}${past}"><span style="font-size: 32px; font-variant-numeric: tabular-nums; ${ELL}">${esc(r.time)}</span><span style="font-size: 34px; ${ELL}">${esc(r.title)}</span><span style="font-size: 24px; color: #333333; text-align: right; text-decoration: none; ${ELL}">${esc(r.tag)}</span></div>`;
}

const message = (text: string) =>
  `<div style="${ROW}"><span style="font-size: 32px">—</span><span style="font-size: 34px; color: #333333; ${ELL}">${esc(text)}</span></div>`;

function dayHeader(day: Date, i: number): string {
  const prefix = ["HÔM NAY · ", "NGÀY MAI · ", ""][i];
  const label = `${prefix}${weekday(day).toUpperCase()} ${day.getDate()}/${day.getMonth() + 1}`;
  return `<div style="height: 64px; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; font-size: 26px; font-weight: 600; color: #333333; letter-spacing: 1px"><span style="${ELL}">${esc(label)}</span><span>${esc(`ÂL ${lunarDate(day)}`.toUpperCase())}</span></div>`;
}

function dayZone(snap: Snapshot, day: Date, i: number, now: Date): string {
  const events = snap.events.value;
  let slots: string[];
  if (pending(snap.events)) {
    slots = [
      `<div style="${ROW}"><span style="width: 160px; ${DASH}"></span><span style="${DASH}"></span><span></span></div>`,
      `<div style="${ROW}"><span style="width: 160px; ${DASH}"></span><span style="width: 50%; ${DASH}"></span><span></span></div>`,
      `<div style="${ROW}"><span></span><span style="font-size: 30px; font-weight: 600">Đang tải lịch…</span></div>`,
    ];
  } else if (!events) {
    const noData = snap.events.error?.includes("CALENDARS") ? "Chưa kết nối lịch" : "Không tải được lịch";
    slots = i === 0 ? [message(noData)] : [];
  } else {
    const rows = agendaDay(events, day, now);
    slots = rows.length ? rows.map((r, k) => row(r, k === rows.length - 1)) : [message("Không có sự kiện")];
  }
  while (slots.length < DAY_SLOTS) slots.push(BLANK);
  const top = i === 0 ? "" : " border-top: 2px solid #000000;";
  return `<div data-zone="day.${i}" style="height: 468px; flex-shrink: 0; box-sizing: border-box; overflow: hidden;${top} display: flex; flex-direction: column">
    ${dayHeader(day, i)}
    <div style="display: flex; flex-direction: column">${slots.join("")}</div>
  </div>`;
}

export function agendaScreen(snap: Snapshot, client: ClientInfo, now: Date): string {
  const synced = oldestOk(snap);
  const days = [0, 1, 2].map((i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  return page(`
  ${statusZone(snap, client, now, synced ? `Cập nhật ${hhmm(synced)}` : "Đang cập nhật…", "sync.now")}
  <div data-zone="header" style="height: 120px; flex-shrink: 0; box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) 220px; align-items: center; border-bottom: 3px solid #000000">
    <span style="font-size: 64px; font-weight: 700">Lịch</span>
    <span style="font-size: 64px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums">${hhmm(now)}</span>
  </div>
  ${days.map((d, i) => dayZone(snap, d, i, now)).join("")}
  ${footerDots(1)}`);
}
