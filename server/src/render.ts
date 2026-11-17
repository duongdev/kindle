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
let connected = false;

// A failed launch or a crashed browser is forgotten, so the next render launches a new one.
export function getBrowser(): Promise<Browser> {
  browser ??= chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] }).then(
    (b) => {
      connected = true;
      b.on("disconnected", () => {
        connected = false;
        browser = undefined;
      });
      return b;
    },
    (e) => {
      browser = undefined;
      throw e;
    },
  );
  return browser;
}

export const browserConnected = () => connected;

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

// One render at a time: each is a full browser page, and the Kindle asks for several screens at once.
let queue: Promise<unknown> = Promise.resolve();

export function render(body: string): Promise<{ png: Buffer; regions: TapRegion[] }> {
  const run = queue.then(() => draw(body));
  queue = run.catch(() => {});
  return run;
}

async function draw(body: string): Promise<{ png: Buffer; regions: TapRegion[] }> {
  // No page scripts: the page is built from fetched text (calendar titles, HA names).
  const page = await (await getBrowser()).newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
  });
  // A hung page must not block the render queue for ever.
  page.setDefaultTimeout(15_000);
  try {
    // The page is built from fetched data; it must never load anything (fonts are inlined data URLs).
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${fontCss}\nbody{margin:0}</style></head><body>${body}</body></html>`,
    );
    // Fonts are inline, so this is instant; the race only guards the render queue against a hang.
    await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 3_000))]);
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
