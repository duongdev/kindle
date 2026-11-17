// Sleep screen (docs/design/screens.md section 0, canvas board "0 Sleep screen").
import { config } from "../config.ts";
import type { ClientInfo, DeviceState, RoomState, Snapshot, Source } from "../model.ts";
import { deg, esc, hhmm, longDate, lunarLabel, weekday } from "../vi.ts";
import {
  acLine,
  acOn,
  agendaZone,
  deviceState,
  ELL,
  feelsLine,
  page,
  pending,
  statusZone,
  weatherZone,
} from "./parts.ts";

function clockZone(now: Date, nextAt: Date): string {
  return `<div data-zone="clock" style="height: 400px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; border-bottom: 3px solid #000000; display: grid; grid-template-rows: 200px 80px 1fr">
    <div style="font-size: 180px; font-weight: 700; line-height: 200px; letter-spacing: -4px; margin-left: -8px; ${ELL}">${weekday(now)}</div>
    <div style="display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: center"><span style="font-size: 56px; font-weight: 600; ${ELL}">${longDate(now)}</span><span style="font-size: 32px; color: #333333; text-align: right; ${ELL}">${lunarLabel(now)}</span></div>
    <div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px"><span style="font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; ${ELL}">Cập nhật lúc ${hhmm(now)}</span><span style="font-size: 30px; color: #333333; font-variant-numeric: tabular-nums">lần tới khoảng ${hhmm(nextAt)}</span></div>
  </div>`;
}

const CELL =
  "height: 156px; box-sizing: border-box; border-top: 2px solid #000000; padding: 14px 0 0; display: grid; overflow: hidden";

// Status cells, not buttons: nothing on the sleep screen looks tappable.
function roomCell(r: RoomState): string {
  return `<div data-room="${esc(r.key)}" style="${CELL}; grid-template-rows: 44px 34px 1fr"><span style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline"><span style="font-size: 32px; line-height: 44px; font-weight: 600; ${ELL}">${esc(r.name)}</span><span style="font-size: 40px; line-height: 44px; font-weight: 700; font-variant-numeric: tabular-nums">${deg(r.tempC)}</span></span><span style="font-size: 26px; line-height: 34px; ${ELL}">${feelsLine(r)}</span><span style="align-self: end; font-size: 28px; line-height: 36px; ${acOn(r) ? "font-weight: 700" : "color: #333333"}; ${ELL}">${acOn(r) ? acLine(r) : "Máy lạnh tắt"}</span></div>`;
}

// No state yet: name from config. Pending (first load) has a dashed top rule (states.md).
const pendingCell = (name: string, failed = false) =>
  `<div style="${CELL}; border-top-style: ${failed ? "solid" : "dashed"}; grid-template-rows: 44px 1fr"><span style="font-size: 32px; line-height: 44px; font-weight: 600; ${ELL}">${esc(name)}</span><span style="align-self: end; font-size: 28px; line-height: 36px; color: #333333">${failed ? "Không có dữ liệu" : "Đang tải…"}</span></div>`;

function deviceCell(src: Source<DeviceState>, fallbackName: string): string {
  if (pending(src)) return pendingCell(fallbackName);
  const d = src.value;
  const bold = d?.reachable && d.on;
  return `<div style="${CELL}; grid-template-rows: 44px 1fr"><span style="font-size: 32px; line-height: 44px; font-weight: 600; ${ELL}">${esc(d?.name ?? fallbackName)}</span><span style="align-self: end; font-size: 28px; line-height: 36px; ${bold ? "font-weight: 700" : "color: #333333"}; ${ELL}">${esc(deviceState(d, "Bật"))}</span></div>`;
}

function tilesZone(snap: Snapshot): string {
  const rooms = snap.rooms.value;
  const cells = rooms
    ? rooms.slice(0, 3).map(roomCell)
    : config.rooms.slice(0, 3).map((r) => pendingCell(r.name, !pending(snap.rooms)));
  cells.push(
    deviceCell(snap.lamp, config.lamp?.name ?? "Đèn ngủ"),
    deviceCell(snap.fan, config.fan?.name ?? "Quạt phòng ngủ"),
  );
  while (cells.length < 6) cells.push('<div aria-hidden="true"></div>');
  return `<div data-zone="tiles" style="height: 360px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, 156px); column-gap: 40px; row-gap: 20px; padding-top: 28px">${cells.slice(0, 6).join("")}</div>`;
}

export function sleepScreen(snap: Snapshot, client: ClientInfo, now: Date, nextAt: Date): string {
  return page(`
  ${statusZone(snap, client, now, "Đang ngủ · màn hình chờ")}
  ${clockZone(now, nextAt)}
  ${weatherZone(snap, now)}
  ${agendaZone(snap, now, { countdown: false })}
  ${tilesZone(snap)}
  <div data-zone="footer" style="height: 40px; flex-shrink: 0; box-sizing: border-box; display: flex; justify-content: center; align-items: flex-end; font-size: 24px; color: #333333">Bấm nút nguồn để mở Kindle · Dashboard trong thư viện</div>`);
}
