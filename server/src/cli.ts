// Render one screen to a file: `pnpm render sleep out/sleep.png`. Uses the same env as the server.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.ts";
import { closeBrowser } from "./render.ts";
import { renderScreen, SCREENS, type ScreenName } from "./screens/index.ts";

process.env.TZ = config.timezone;

const [name = "sleep", out = `out/${name}.png`] = process.argv.slice(2);
if (!SCREENS.includes(name as ScreenName)) throw new Error(`unknown screen ${name}`);
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();

const t0 = Date.now();
const { png, regions } = await renderScreen(name as ScreenName, { battery: 82, wifi: false }, now);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`${out}: ${png.length} bytes, ${regions.length} tap regions, ${Date.now() - t0} ms`);
await closeBrowser();
