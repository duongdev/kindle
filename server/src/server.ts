import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runAction } from "./actions.ts";
import { config, env } from "./config.ts";
import { browserConnected, getBrowser, toFramebuffer } from "./render.ts";
import { clientInfo, renderScreen, SCREENS, type ScreenName } from "./screens/index.ts";
import { anyFresh, ensureData, errorClass, refresh, snapshot } from "./store.ts";

process.env.TZ = config.timezone;

function reply(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const screen = url.pathname.match(/^\/screen\/([a-z]+)\.(png|json|raw)$/);
  if (req.method === "GET" && screen && SCREENS.includes(screen[1] as ScreenName)) {
    const { png, regions } = await renderScreen(screen[1] as ScreenName, clientInfo(url.searchParams));
    if (screen[2] === "png") return reply(res, 200, "image/png", png);
    if (screen[2] === "raw") return reply(res, 200, "application/octet-stream", await toFramebuffer(png));
    return reply(res, 200, "application/json", JSON.stringify({ width: 1264, height: 1680, regions }));
  }
  const action = url.pathname.match(/^\/action\/([a-z0-9.]+)$/);
  if (req.method === "POST" && action) {
    // Actions switch real devices: only the viewer may call them, never a web page on the LAN.
    if (req.headers.origin || !env.actionToken || req.headers.authorization !== `Bearer ${env.actionToken}`) {
      return reply(res, 403, "text/plain", "forbidden\n");
    }
    if (env.fixtures) return reply(res, 409, "text/plain", "actions are off in fixture mode\n");
    if (action[1] === "sync.now") void refresh(true);
    else runAction(action[1]);
    return reply(res, 204, "text/plain", "");
  }
  if (url.pathname === "/healthz") {
    const browser = browserConnected();
    // A crashed browser relaunches on the next render; start it now so the container heals without one.
    if (!browser) getBrowser().catch(() => {});
    const ok = browser && anyFresh();
    const sources = Object.fromEntries(
      Object.entries(snapshot).map(([k, s]) => [k, { okAt: s.okAt, error: s.error && errorClass(s.error) }]),
    );
    const body = JSON.stringify({ ok, browser, fixtures: Boolean(env.fixtures), sources });
    return reply(res, ok ? 200 : 503, "application/json", body);
  }
  reply(res, 404, "text/plain", "not found\n");
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(req.method, req.url, e);
    reply(res, 500, "text/plain", `${e instanceof Error ? e.message : e}\n`);
  });
}).listen(env.port, () => console.log(`dashboard server on :${env.port}${env.fixtures ? " (fixtures)" : ""}`));

// Warm up: the first Kindle request should not pay for the browser launch and the first fetch.
getBrowser().catch((e) => console.error("browser launch failed:", e instanceof Error ? e.message : e));
void ensureData();
