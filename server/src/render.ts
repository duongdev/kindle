import { type Browser, chromium } from "playwright-core";
import sharp from "sharp";
import { fontCss } from "./fonts.ts";

export const WIDTH = 1264;
export const HEIGHT = 1680;

export interface TapRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

let browser: Promise<Browser> | undefined;

function getBrowser() {
  browser ??= chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
  return browser;
}

// Kindle panels show 16 gray levels; snapping here keeps text edges crisp instead of letting the panel dither.
async function toKindlePng(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).grayscale().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i++) data[i] = Math.round(data[i] / 17) * 17;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Kindle Oasis 3 framebuffer: 8-bit gray, 1264 visible columns in 1280-byte rows. The stock eips draws PNGs
// 3x wide on this panel (it writes 3 bytes per pixel), so the daemon writes these bytes to /dev/fb0 itself.
export const FB_STRIDE = 1280;

export async function toFramebuffer(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .grayscale()
    .extend({ right: FB_STRIDE - WIDTH, background: "#ffffff" })
    .raw()
    .toBuffer();
}

export async function render(body: string): Promise<{ png: Buffer; regions: TapRegion[] }> {
  const page = await (await getBrowser()).newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${fontCss}\nbody{margin:0}</style></head><body>${body}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const regions = await page.$$eval("[data-action]", (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute("data-action") ?? "",
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }),
    );
    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    return { png: await toKindlePng(shot), regions };
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) await (await browser).close();
  browser = undefined;
}
