import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config.ts";

export async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`GET ${new URL(url).pathname} ${res.status}`);
  return (await res.json()) as T;
}

export async function send(
  method: "POST" | "PUT",
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${method} ${new URL(url).pathname} ${res.status}`);
  return res;
}

export function fixture<T>(name: string): T {
  if (!env.fixtures) throw new Error("FIXTURES is not set");
  return JSON.parse(readFileSync(resolve(env.fixtures, name), "utf8")) as T;
}

export function num(v: unknown, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number | undefined {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
