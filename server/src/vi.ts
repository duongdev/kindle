import { solarToLunar } from "./lunar.ts";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export const weekday = (d: Date) => WEEKDAYS[d.getDay()];
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const longDate = (d: Date) => `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
export const deg = (c: number | undefined) => (c === undefined ? "—°" : `${Math.round(c)}°`);

export function lunarDate(d: Date): string {
  const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
  const day = l.day === 15 ? "Rằm" : l.day === 1 ? "Mùng 1" : String(l.day);
  return `${day}/${l.month}${l.leap ? " nhuận" : ""}`;
}

export const lunarLabel = (d: Date) => `Âm lịch ${lunarDate(d)}`;

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// WMO weather interpretation codes (Open-Meteo).
export function weatherLabel(code: number | undefined): string {
  if (code === undefined) return "—";
  if (code === 0) return "Trời quang";
  if (code === 1) return "Ít mây";
  if (code === 2) return "Có mây";
  if (code === 3) return "Nhiều mây";
  if (code === 45 || code === 48) return "Sương mù";
  if (code >= 51 && code <= 57) return "Mưa phùn";
  if (code === 61 || code === 80) return "Mưa nhỏ";
  if (code === 63 || code === 81) return "Mưa vừa";
  if (code === 65 || code === 82 || code === 66 || code === 67) return "Mưa to";
  if (code >= 71 && code <= 77) return "Tuyết";
  if (code >= 95) return "Dông";
  return "—";
}

const S = 'fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const SUN =
  '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>';
const CLOUD = '<path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 19z"/>';
const PART =
  '<circle cx="9" cy="9" r="3.5"/><path d="M9 2v1.5M2 9h1.5M4 4l1 1M14 4l-1 1"/><path d="M8 19h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.5A2.8 2.8 0 0 0 8 19z"/>';
const RAIN =
  '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>';
const STORM =
  '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 15z"/><path d="M12 15l-2 4h4l-2 4"/>';
const FOG = '<path d="M4 9h16M4 13h16M4 17h16"/>';

export function weatherIcon(code: number | undefined, size = 88): string {
  const body =
    code === undefined
      ? ""
      : code === 0
        ? SUN
        : code <= 2
          ? PART
          : code === 3
            ? CLOUD
            : code <= 48
              ? FOG
              : code >= 95
                ? STORM
                : RAIN;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${S} aria-hidden="true">${body}</svg>`;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
