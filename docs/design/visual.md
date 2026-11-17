# Visual language

## Principles

- Black and white first. The screen has 16 gray levels, but mid-gray fills ghost on partial refresh and look muddy. Use gray only for secondary text.
- Black fill means "now" or "on". Only one black agenda row on a screen.
- Lines, not boxes, split zones on Home: 3 px between zones, 2 px inside a zone, 1 px between list rows.
- No animation, no icons except the weather glyph. Text labels over symbols.

## Colors

| Token | Value | Use |
|---|---|---|
| ink | #000000 | text, lines, on-state fill |
| ink-2 | #333333 | secondary text (status, labels, footer) |
| paper | #FFFFFF | background |

No other values. Keep #333 or darker for text; lighter gray dithers and loses contrast on e-ink.

## Type

Font: Be Vietnam Pro (OFL, made for Vietnamese), bundled as local TTF files on the render server (ADR 0002); no fonts from the internet. Fallback: Noto Sans. The canvas loads Be Vietnam Pro from Google Fonts only for the preview.

| Role | Size (px) | Weight | Note |
|---|---|---|---|
| Clock | 290 | 700 | tabular digits, -10 px tracking |
| Big value (weather, room on Rooms) | 96–120 | 700 | |
| Screen title, small clock | 64 | 700 | |
| Date line | 46 | 600 | |
| Event title, room name | 36–38 | 400 / 600 | |
| Tile label | 32 | 600 | |
| Body, event time | 30–34 | 400 | tabular digits for times |
| Section label | 26 | 600 | upper case, 1 px tracking |
| Status line | 26 | 400 | smallest size on screen |

At 300 DPI, 26 px is about 6.2 pt: readable at desk distance (40–60 cm). Do not go smaller. One exception: the data credit ("Nguồn: Open-Meteo") is 22 px.

## Numbers and dates (Vietnamese)

- Time: 24 h, "10:24".
- Decimal comma: "28,5°".
- Date: "Thứ Ba, 17 tháng 11"; short form "17/11".
- Weekdays: Thứ Hai … Thứ Bảy, Chủ Nhật.
- Lunar: "Âm lịch 9/10" (day/month). Day 15: "Âm lịch Rằm/10"; day 1: "Âm lịch Mùng 1/10". Agenda day header: "ÂL RẰM/10", "ÂL MÙNG 1/10".

## Grayscale output

The server converts each PNG to 16 gray levels, no dithering for text. So: text is #000 or #333 only, no text lighter than #333, no hairlines under 1 px, no gradients, no shadows.

## Touch targets

Tiles 156 px tall (about 13 mm), toggles on Rooms 104 px (about 9 mm). Minimum 100 px (8.5 mm). 20 px gap between tiles.
