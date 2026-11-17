// Zones shared by the screens. Sizes come from docs/design/layout-grid.md and the canvas boards.
import { homeAgenda, nextLabel } from "../agenda.ts";
import { feelsLikeC } from "../feels.ts";
import type { ClientInfo, DeviceState, RoomState, Snapshot, Source } from "../model.ts";
import { deg, esc, hhmm, sameDay, weatherIcon, weatherLabel } from "../vi.ts";

export const ELL = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis";
const STALE_MS = 60 * 60 * 1000;

export const AC_MODE: Record<string, string> = {
  cool: "Lạnh",
  auto: "Tự động",
  heat: "Sưởi",
  dry: "Khô",
  fan_only: "Quạt",
};

export function page(body: string): string {
  return `<div style="width: 1264px; height: 1680px; box-sizing: border-box; padding: 40px 64px 32px; background: #ffffff; color: #000000; font-family: 'Be Vietnam Pro', 'Noto Sans', sans-serif; display: flex; flex-direction: column">${body}</div>`;
}

// states.md "Pending": first load, no value and no error yet.
export const pending = (s: Source<unknown>) => s.value === undefined && !s.error;
export const DASHED = "border: 2px dashed #000000; box-sizing: border-box";

export function oldestOk(snap: Snapshot): Date | undefined {
  const times = Object.values(snap).map((s) => s.okAt?.getTime() ?? 0);
  const oldest = Math.min(...times);
  return oldest > 0 ? new Date(oldest) : undefined;
}

// states.md "Status line". Priority: low battery, stale, then the screen's normal text.
export function statusZone(snap: Snapshot, client: ClientInfo, now: Date, normalLeft: string, action?: string): string {
  const batt = client.battery;
  const lowBatt = batt !== undefined && batt <= 15 && !client.charging;
  const oldest = oldestOk(snap);
  const stale = oldest ? now.getTime() - oldest.getTime() > STALE_MS : false;
  const right = lowBatt
    ? `Pin ${batt}% · Hãy sạc`
    : client.charging
      ? `Đang sạc · ${batt ?? "—"}%`
      : `Wi‑Fi ${client.wifi ? "bật" : "tắt"} · Pin ${batt ?? "—"}%`;
  const left = stale && oldest ? `Dữ liệu cũ · cập nhật lúc ${hhmm(oldest)}` : normalLeft;
  const look =
    lowBatt || stale ? "background: #000000; color: #ffffff; padding: 0 12px; margin: 0 -12px" : "color: #333333";
  return `<div data-zone="status"${action ? ` data-action="${action}"` : ""} style="height: 44px; flex-shrink: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; font-size: 26px; ${look}; font-variant-numeric: tabular-nums">
    <span style="${ELL}">${esc(left)}</span>
    <span style="text-align: right; ${ELL}">${esc(right)}</span>
  </div>`;
}

function weatherPending(): string {
  const col = `<div style="display: grid; grid-template-rows: 34px 42px 68px 32px; justify-items: center; align-items: end"><span style="font-size: 24px; color: #333333">—</span><span style="width: 52px; height: 32px; ${DASHED}"></span><span style="width: 36px; height: 64px; ${DASHED}"></span><span style="width: 44px; height: 24px; ${DASHED}"></span></div>`;
  return `<div data-zone="weather" style="height: 270px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 3px solid #000000">
    <div style="box-sizing: border-box; padding-right: 40px; border-right: 2px solid #000000; display: flex; flex-direction: column; justify-content: center; gap: 16px; min-width: 0">
      <div style="display: flex; align-items: center; gap: 24px"><span style="width: 88px; height: 88px; border-radius: 44px; ${DASHED}"></span><span style="width: 180px; height: 96px; ${DASHED}"></span></div>
      <div style="font-size: 32px; font-weight: 600; ${ELL}">Đang tải thời tiết…</div>
      <span style="width: 70%; height: 26px; ${DASHED}"></span>
    </div>
    <div style="box-sizing: border-box; padding: 20px 0 0 40px; display: flex; flex-direction: column; min-width: 0">
      <div style="height: 48px; flex-shrink: 0; font-size: 26px; line-height: 48px; font-weight: 600; color: #333333; letter-spacing: 1px">6 GIỜ TỚI · MƯA</div>
      <div style="height: 186px; flex-shrink: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px">${col.repeat(6)}</div>
    </div>
  </div>`;
}

export function weatherZone(snap: Snapshot, now: Date): string {
  if (pending(snap.weather)) return weatherPending();
  const w = snap.weather.value;
  if (!w) {
    return `<div data-zone="weather" style="height: 270px; flex-shrink: 0; box-sizing: border-box; border-bottom: 3px solid #000000; display: flex; align-items: center; font-size: 36px; font-weight: 600">—° · Chưa có dữ liệu</div>`;
  }
  const rain = w.hourly.find((h) => sameDay(h.time, now) && h.time > now && h.rainPct >= 50);
  const cond = `${weatherLabel(w.code)} · ${rain ? `Mưa lúc ${hhmm(rain.time)}` : "Không mưa"}`;
  const cols = w.hourly
    .filter((h) => h.time > now)
    .slice(0, 6)
    .map(
      (h) =>
        `<div style="display: grid; grid-template-rows: 34px 42px 68px 32px; justify-items: center; align-items: end"><span style="font-size: 24px; color: #333333">${h.time.getHours()}h</span><span style="font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums">${deg(h.tempC)}</span><span style="width: 36px; height: 64px; box-sizing: border-box; border: 2px solid #000000; display: flex; align-items: flex-end"><span style="width: 100%; height: ${Math.round(h.rainPct * 0.6)}px; background: #000000"></span></span><span style="font-size: 24px; font-variant-numeric: tabular-nums">${h.rainPct}%</span></div>`,
    )
    .join("");
  return `<div data-zone="weather" style="height: 270px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 3px solid #000000">
    <div style="box-sizing: border-box; padding: 20px 40px 0 0; border-right: 2px solid #000000; display: flex; flex-direction: column; min-width: 0">
      <div style="height: 120px; flex-shrink: 0; display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; gap: 24px">
        ${weatherIcon(w.code)}
        <span style="font-size: 120px; font-weight: 700; line-height: 120px; font-variant-numeric: tabular-nums; white-space: nowrap">${deg(w.tempC)}</span>
      </div>
      <div style="height: 50px; flex-shrink: 0; font-size: 36px; line-height: 50px; font-weight: 600; ${ELL}">${esc(cond)}</div>
      <div style="height: 40px; flex-shrink: 0; font-size: 28px; line-height: 40px; color: #333333; ${ELL}">Cảm giác ${deg(w.apparentC)} · Cao ${deg(w.highC)} · Thấp ${deg(w.lowC)}</div>
      <div style="height: 30px; flex-shrink: 0; font-size: 22px; line-height: 30px; color: #333333; ${ELL}">Nguồn: Open-Meteo</div>
    </div>
    <div style="box-sizing: border-box; padding: 20px 0 0 40px; display: flex; flex-direction: column; min-width: 0">
      <div style="height: 48px; flex-shrink: 0; font-size: 26px; line-height: 48px; font-weight: 600; color: #333333; letter-spacing: 1px">6 GIỜ TỚI · MƯA</div>
      <div style="height: 186px; flex-shrink: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px">${cols}</div>
    </div>
  </div>`;
}

export function agendaZone(snap: Snapshot, now: Date, opts: { countdown: boolean; action?: string }): string {
  const events = snap.events.value;
  const a = events ? homeAgenda(events, now) : undefined;
  const label = `<span style="font-size: 26px; font-weight: 600; color: #333333; letter-spacing: 1px">HÔM NAY</span>`;
  const head = `<div style="height: 42px; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center">${label}<span style="font-size: 26px; color: #333333">${a ? esc(a.header) : ""}</span></div>`;

  const wait = pending(snap.events);
  const noCalendar = snap.events.error?.includes("CALENDARS");
  // states.md "Pending and empty, per section", D Agenda.
  const msg: [string, string, number] | undefined = wait
    ? undefined
    : a?.empty === "Hôm nay trống"
      ? ["Hôm nay trống", "Không còn sự kiện nào.", 44]
      : a?.empty
        ? [a.empty, "trong 7 ngày tới", 36]
        : events
          ? undefined
          : noCalendar
            ? ["Chưa kết nối lịch", "Thêm địa chỉ lịch trong tệp cấu hình.", 36]
            : ["Không tải được lịch", "", 36];
  const dashedRow = (w: string) =>
    `<div style="height: 100%; display: flex; align-items: center; gap: 20px"><span style="width: 110px; height: 34px; ${DASHED}"></span><span style="width: ${w}; height: 34px; ${DASHED}"></span></div>`;
  let next = `<div data-slot="agenda.next" style="height: 168px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 6px">${
    wait
      ? dashedRow("100%")
      : msg
        ? `<span style="font-size: ${msg[2]}px; font-weight: 700; ${ELL}">${esc(msg[0])}</span>${msg[1] ? `<span style="font-size: ${msg[2] > 36 ? 30 : 28}px; color: #333333; ${ELL}">${esc(msg[1])}</span>` : ""}`
        : ""
  }</div>`;
  if (a?.next) {
    const e = a.next.event;
    const detail = `${e.tentative ? "? Chưa xác nhận · " : ""}${hhmm(e.start)}–${hhmm(e.end)}`;
    next = `<div data-slot="agenda.next" style="height: 168px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 28px; background: #000000; color: #ffffff; padding: 18px 20px; margin: 0 -20px">
      <span style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 34px; line-height: 44px; font-weight: 700; font-variant-numeric: tabular-nums">${hhmm(e.start)}</span><span style="font-size: 26px; line-height: 34px; font-weight: 600; white-space: nowrap">${nextLabel(e.start, a.next.inProgress, now, opts.countdown)}</span></span>
      <span style="display: flex; flex-direction: column; min-width: 0"><span style="height: 94px; font-size: 36px; font-weight: 600; line-height: 47px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden">${esc((e.tentative ? "? " : "") + e.title)}</span><span style="height: 38px; font-size: 26px; line-height: 38px; ${ELL}">${esc(detail)}</span></span>
    </div>`;
  }

  const rows = [0, 1]
    .map((i) => {
      const r = a?.rows[i];
      if (wait)
        return `<div data-slot="agenda.${i + 1}" style="height: 72px; flex-shrink: 0">${dashedRow(i ? "45%" : "60%")}</div>`;
      if (!r) return `<div data-slot="agenda.${i + 1}" style="height: 72px; flex-shrink: 0"></div>`;
      const more = r.more
        ? `<span style="font-size: 30px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums">+${r.more}</span>`
        : "<span></span>";
      return `<div data-slot="agenda.${i + 1}" style="height: 72px; flex-shrink: 0; box-sizing: border-box; border-bottom: 1px solid #000000; display: grid; grid-template-columns: 200px minmax(0, 1fr) 120px; gap: 28px; align-items: center"><span style="font-size: 30px; font-variant-numeric: tabular-nums; ${ELL}">${esc(r.time ?? "")}</span><span style="font-size: 32px; ${ELL}">${esc(r.text)}</span>${more}</div>`;
    })
    .join("");

  const t = a?.tomorrow;
  const tomorrow = wait
    ? `<div data-slot="agenda.tomorrow" style="height: 92px; flex-shrink: 0; display: flex; align-items: center; font-size: 32px; font-weight: 600">Đang tải lịch…</div>`
    : `<div data-slot="agenda.tomorrow" style="height: 92px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px">
      <span style="font-size: 26px; line-height: 34px; font-weight: 600; color: #333333; letter-spacing: 1px">NGÀY MAI</span>
      <span style="font-size: 30px; line-height: 40px; ${ELL}">${t ? esc(`${hhmm(t.start)} ${t.tentative ? "? " : ""}${t.title}`) : events ? "Không có sự kiện" : "—"}</span>
    </div>`;

  return `<div data-zone="agenda"${opts.action ? ` data-action="${opts.action}"` : ""} style="height: 494px; flex-shrink: 0; box-sizing: border-box; overflow: hidden; padding-top: 24px; border-bottom: 3px solid #000000; display: flex; flex-direction: column">${head}${next}${rows}${tomorrow}</div>`;
}

export function feelsLine(r: RoomState): string {
  return r.tempC !== undefined && r.humidity !== undefined
    ? `Cảm giác ${deg(feelsLikeC(r.tempC, r.humidity))} · ${Math.round(r.humidity)}%`
    : "Không có dữ liệu";
}

export const acOn = (r: RoomState) => Boolean(r.ac && r.ac.mode !== "off");

export function acLine(r: RoomState): string {
  if (!r.ac) return "Máy lạnh: —";
  return acOn(r) ? `Máy lạnh: ${AC_MODE[r.ac.mode] ?? r.ac.mode} ${deg(r.ac.setpoint)}` : "Máy lạnh: Tắt";
}

// "Bật · số 2" on the sleep screen, "BẬT · số 2" on buttons (states.md).
// Callers show "Đang tải…" for a pending source; no value after an error reads as unreachable.
export function deviceState(d: DeviceState | undefined, onWord: string): string {
  if (!d?.reachable) return "Không phản hồi";
  if (!d.on) return "Tắt";
  return d.detail ? `${onWord} · ${d.detail}` : onWord;
}

export function footerDots(current: number, total = 3): string {
  const dots = Array.from({ length: total }, (_, i) =>
    i === current
      ? '<span style="width: 16px; height: 16px; border-radius: 8px; background: #000000"></span>'
      : '<span style="width: 16px; height: 16px; border-radius: 8px; border: 2px solid #000000; box-sizing: border-box"></span>',
  ).join("");
  return `<div data-zone="footer" style="height: 40px; flex-shrink: 0; box-sizing: border-box; display: flex; justify-content: center; align-items: flex-end; gap: 16px">${dots}</div>`;
}
