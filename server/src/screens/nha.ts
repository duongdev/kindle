// Nhà, home control (docs/design/screens.md section 3, canvas board "Nhà").
import { config, type RoomConfig } from "../config.ts";
import { feelsLikeC } from "../feels.ts";
import type { ClientInfo, DeviceState, RoomState, Snapshot, Source } from "../model.ts";
import { deg, esc, hhmm } from "../vi.ts";
import { acOn, DASHED, deviceState, ELL, footerDots, oldestOk, page, pending, statusZone } from "./parts.ts";

const MAX_ROOMS = 4;
// The lamp and fan presets live on this room's card (owner's setup).
const PRESET_ROOM = "bedroom";

const BTN =
  "height: 104px; box-sizing: border-box; border: 3px solid #000000; font-size: 32px; display: flex; align-items: center; gap: 12px; padding: 0 24px; min-width: 0";
const look = (on: boolean) => (on ? "background: #000000; color: #ffffff; font-weight: 700" : "background: #ffffff");

function acRow(r: RoomState): string {
  if (!r.ac) return '<div style="height: 104px; flex-shrink: 0"></div>';
  const on = acOn(r);
  const k = esc(r.key);
  return `<div style="height: 104px; flex-shrink: 0; display: grid; grid-template-columns: 300px 104px 160px 104px minmax(0, 1fr); gap: 20px; align-items: center">
    <div data-action="ac.${k}.toggle" style="${BTN}; ${look(on)}; justify-content: space-between"><span>Máy lạnh</span><span>${on ? "BẬT" : "Tắt"}</span></div>
    <div data-action="ac.${k}.temp.down" style="${BTN}; ${look(false)}; justify-content: center"><span>−</span></div>
    <span style="display: flex; flex-direction: column; align-items: center"><span style="font-size: 48px; font-weight: 700; line-height: 56px; font-variant-numeric: tabular-nums">${deg(r.ac.setpoint)}</span><span style="font-size: 22px; color: #333333">đặt</span></span>
    <div data-action="ac.${k}.temp.up" style="${BTN}; ${look(false)}; justify-content: center"><span>+</span></div>
    <span style="font-size: 24px; color: #333333; text-align: right">theo lệnh cuối</span>
  </div>`;
}

function preset(src: Source<DeviceState>, label: string, action: string): string {
  if (pending(src)) {
    return `<div style="${BTN}; border-style: dashed; justify-content: space-between"><span style="${ELL}">${esc(label)}</span><span style="font-size: 28px; white-space: nowrap">Đang tải…</span></div>`;
  }
  const d = src.value;
  const on = Boolean(d?.reachable && d.on);
  const usable = Boolean(d?.reachable);
  const border = usable ? "" : "border-style: dotted; color: #333333; ";
  return `<div${usable ? ` data-action="${action}"` : ""} style="${BTN}; ${look(on)}; ${border}justify-content: space-between"><span style="${ELL}">${esc(label)}</span><span style="white-space: nowrap">${esc(deviceState(d, "BẬT"))}</span></div>`;
}

function presetRow(snap: Snapshot): string {
  return `<div style="height: 104px; flex-shrink: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px">${preset(snap.lamp, "Đèn ngủ", "lamp.bedroom.toggle")}${preset(snap.fan, "Quạt", "fan.bedroom.toggle")}</div>`;
}

const card = (key: string, border: string, body: string) =>
  `<div data-room="${esc(key)}" style="height: ${key === PRESET_ROOM ? 384 : 264}px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; border: 3px ${border} #000000; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px">${body}</div>`;

const ROW1 =
  "height: 100px; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) 220px 130px; align-items: center; gap: 16px";
const nameCell = (name: string, sub: string) =>
  `<span style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><span style="font-size: 40px; line-height: 52px; font-weight: 700; ${ELL}">${esc(name)}</span><span style="height: 34px; font-size: 26px; line-height: 34px; color: #333333">${sub}</span></span>`;

// Row 1 right side per states.md "Room card states": no sensor configured = blank; configured but no reading = "—°" + "Không có dữ liệu".
function roomCard(r: RoomState, snap: Snapshot): string {
  const cfg = config.rooms.find((c) => c.key === r.key);
  const sensor = !cfg || Boolean(cfg.temperature || cfg.humidity);
  const noData = r.tempC === undefined && r.humidity === undefined;
  const feels =
    r.tempC !== undefined && r.humidity !== undefined ? `Cảm giác ${deg(feelsLikeC(r.tempC, r.humidity))}` : "";
  const right = !sensor
    ? "<span></span><span></span>"
    : noData
      ? `<span style="font-size: 80px; font-weight: 700; line-height: 100px; text-align: right">—°</span><span style="justify-self: end; font-size: 26px; color: #333333; white-space: nowrap">Không có dữ liệu</span>`
      : `<span style="font-size: 80px; font-weight: 700; line-height: 100px; text-align: right; font-variant-numeric: tabular-nums">${deg(r.tempC)}</span><span style="font-size: 32px; color: #333333; text-align: right; font-variant-numeric: tabular-nums">${r.humidity === undefined ? "—%" : `${Math.round(r.humidity)}%`}</span>`;
  return card(
    r.key,
    "solid",
    `<div style="${ROW1}">${nameCell(r.name, feels)}${right}</div>
    ${acRow(r)}
    ${r.key === PRESET_ROOM ? presetRow(snap) : ""}`,
  );
}

// Pending (first load): name from config, dashed value boxes and controls (canvas "Pending + empty, per section").
function pendingCard(r: RoomConfig, snap: Snapshot): string {
  return card(
    r.key,
    "dashed",
    `<div style="${ROW1}">${nameCell(r.name, "")}<span style="justify-self: end; width: 200px; height: 80px; ${DASHED}"></span><span style="justify-self: end; width: 100px; height: 36px; ${DASHED}"></span></div>
    <div style="height: 104px; flex-shrink: 0; display: grid; grid-template-columns: 300px 104px 160px 104px minmax(0, 1fr); gap: 20px; align-items: center"><span style="${BTN}; border-style: dashed"><span style="white-space: nowrap">Máy lạnh</span></span><span style="height: 104px; border: 3px dashed #000000; box-sizing: border-box"></span><span style="height: 56px; ${DASHED}"></span><span style="height: 104px; border: 3px dashed #000000; box-sizing: border-box"></span><span style="font-size: 28px; font-weight: 600; text-align: right; ${ELL}">Đang tải…</span></div>
    ${r.key === PRESET_ROOM ? presetRow(snap) : ""}`,
  );
}

export function nhaScreen(snap: Snapshot, client: ClientInfo, now: Date): string {
  const rooms = snap.rooms.value;
  const synced = oldestOk(snap);
  let body: string;
  if (pending(snap.rooms)) {
    body = config.rooms
      .slice(0, MAX_ROOMS)
      .map((r) => pendingCard(r, snap))
      .join("");
  } else if (!rooms) {
    const hint = snap.rooms.error?.includes("HA_URL")
      ? "Thêm địa chỉ Home Assistant trong tệp cấu hình. Thời tiết và lịch vẫn hoạt động."
      : "Không tải được dữ liệu nhà. Thời tiết và lịch vẫn hoạt động.";
    body = `<div style="border: 3px dashed #000000; padding: 32px; display: flex; flex-direction: column; gap: 10px"><span style="font-size: 40px; font-weight: 700">Chưa kết nối Home Assistant</span><span style="font-size: 28px; color: #333333; line-height: 1.4">${hint}</span></div>`;
  } else {
    body = rooms
      .slice(0, MAX_ROOMS)
      .map((r) => roomCard(r, snap))
      .join("");
    if (rooms.length > MAX_ROOMS) {
      body += `<div style="height: 60px; font-size: 26px; color: #333333">+${rooms.length - MAX_ROOMS} phòng không hiện. Tối đa ${MAX_ROOMS} phòng trong v1.</div>`;
    }
  }
  return page(`
  ${statusZone(snap, client, now, synced ? `Trạng thái lúc ${hhmm(synced)}` : "Đang cập nhật…", "sync.now")}
  <div data-zone="header" style="height: 120px; flex-shrink: 0; box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) 220px; align-items: center; border-bottom: 3px solid #000000">
    <span style="font-size: 64px; font-weight: 700">Nhà</span>
    <span style="font-size: 64px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums">${hhmm(now)}</span>
  </div>
  <div data-zone="rooms" style="height: 1404px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; padding-top: 32px; display: flex; flex-direction: column; gap: 32px">${body}</div>
  ${footerDots(2)}`);
}
