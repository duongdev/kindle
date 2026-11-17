// Home, the glance screen (docs/design/screens.md section 1, canvas board "Home").
import { config } from "../config.ts";
import type { ClientInfo, DeviceState, RoomState, Snapshot, Source } from "../model.ts";
import { deg, esc, hhmm, lunarLabel, weekday } from "../vi.ts";
import {
  acLine,
  acOn,
  agendaZone,
  deviceState,
  ELL,
  feelsLine,
  footerDots,
  oldestOk,
  page,
  pending,
  statusZone,
  weatherZone,
} from "./parts.ts";

function clockZone(now: Date): string {
  const date = `${weekday(now)}, ${now.getDate()} tháng ${now.getMonth() + 1}`;
  return `<div data-zone="clock" style="height: 400px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; border-bottom: 3px solid #000000; display: flex; flex-direction: column">
    <div style="height: 290px; margin-top: 12px; flex-shrink: 0; font-size: 290px; font-weight: 700; line-height: 290px; letter-spacing: -10px; font-variant-numeric: tabular-nums; margin-left: -12px; white-space: nowrap">${hhmm(now)}</div>
    <div style="height: 64px; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: center">
      <span style="font-size: 46px; font-weight: 600; ${ELL}">${date}</span>
      <span style="font-size: 32px; color: #333333; text-align: right; ${ELL}">${lunarLabel(now)}</span>
    </div>
  </div>`;
}

const BUTTON = "height: 156px; box-sizing: border-box; border: 3px solid #000000; text-align: left; overflow: hidden";
const look = (on: boolean) => (on ? "background: #000000; color: #ffffff" : "background: #ffffff");

function acTile(r: RoomState): string {
  const on = acOn(r);
  const action = r.ac ? ` data-action="ac.${esc(r.key)}.toggle"` : "";
  return `<div${action} style="${BUTTON}; ${look(on)}; padding: 14px 24px; display: grid; grid-template-rows: 44px 34px 1fr"><span style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline"><span style="font-size: 32px; line-height: 44px; font-weight: 600; ${ELL}">${esc(r.name)}</span><span style="font-size: 40px; line-height: 44px; font-weight: 700; font-variant-numeric: tabular-nums">${deg(r.tempC)}</span></span><span style="font-size: 26px; line-height: 34px; ${ELL}">${feelsLine(r)}</span><span style="align-self: end; font-size: 28px; line-height: 36px; ${on ? "font-weight: 700; " : ""}${ELL}">${acLine(r)}</span></div>`;
}

const LABEL =
  "font-size: 32px; line-height: 40px; height: 80px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden";

// No state yet: name from config, not tappable. Pending (first load) is dashed; failed with no cache is dotted (states.md).
const pendingTile = (name: string, failed = false) =>
  `<div style="${BUTTON}; border-style: ${failed ? "dotted; color: #333333" : "dashed"}; padding: 16px 24px; display: flex; flex-direction: column; justify-content: space-between"><span style="${LABEL}">${esc(name)}</span><span style="font-size: 28px">${failed ? "Không có dữ liệu" : "Đang tải…"}</span></div>`;

// Unreachable devices get a dotted border and no tap region (states.md).
function deviceTile(src: Source<DeviceState>, fallbackName: string, action: string): string {
  const d = src.value;
  if (pending(src)) return pendingTile(fallbackName);
  const on = Boolean(d?.reachable && d.on);
  const usable = Boolean(d?.reachable);
  const border = usable ? "" : "border-style: dotted; color: #333333; ";
  return `<div${usable ? ` data-action="${action}"` : ""} style="${BUTTON}; ${look(on)}; ${border}padding: 16px 24px; display: flex; flex-direction: column; justify-content: space-between"><span style="${LABEL}">${esc(d?.name ?? fallbackName)}</span><span style="font-size: 30px; ${on ? "font-weight: 700; " : ""}white-space: nowrap">${esc(deviceState(d, "BẬT"))}</span></div>`;
}

function tilesZone(snap: Snapshot): string {
  if (!config.rooms.length && !config.lamp && !config.fan) {
    return `<div data-zone="tiles" style="height: 360px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; padding-top: 28px"><div style="height: 156px; box-sizing: border-box; border: 3px dashed #000000; padding: 24px; display: flex; flex-direction: column; justify-content: center; gap: 8px"><span style="font-size: 34px; font-weight: 700">Chưa chọn thiết bị</span><span style="font-size: 28px; color: #333333">Chọn thiết bị trong tệp cấu hình.</span></div></div>`;
  }
  const rooms = snap.rooms.value;
  const tiles = rooms
    ? rooms.slice(0, 3).map(acTile)
    : config.rooms.slice(0, 3).map((r) => pendingTile(r.name, !pending(snap.rooms)));
  tiles.push(
    deviceTile(snap.lamp, config.lamp?.name ?? "Đèn ngủ", "lamp.bedroom.toggle"),
    deviceTile(snap.fan, config.fan?.name ?? "Quạt phòng ngủ", "fan.bedroom.toggle"),
  );
  while (tiles.length < 6) tiles.push('<div aria-hidden="true"></div>');
  return `<div data-zone="tiles" style="height: 360px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, 156px); gap: 20px; padding-top: 28px">${tiles.slice(0, 6).join("")}</div>`;
}

export function homeScreen(snap: Snapshot, client: ClientInfo, now: Date): string {
  const synced = oldestOk(snap);
  return page(`
  ${statusZone(snap, client, now, synced ? `Cập nhật ${hhmm(synced)}` : "Đang cập nhật…", "sync.now")}
  ${clockZone(now)}
  ${weatherZone(snap, now)}
  ${agendaZone(snap, now, { countdown: true, action: "nav.agenda" })}
  ${tilesZone(snap)}
  ${footerDots(0)}`);
}
