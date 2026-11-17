import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Fonts are inlined as data URLs: the page is rendered from a string, with no network and no file origin.
const pkg = dirname(createRequire(import.meta.url).resolve("@fontsource/be-vietnam-pro/package.json"));

export const fontCss = [400, 600, 700]
  .map((w) =>
    readFileSync(resolve(pkg, `${w}.css`), "utf8")
      .replace(/,\s*url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, "")
      .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, f: string) => {
        const b64 = readFileSync(resolve(pkg, "files", f)).toString("base64");
        return `url(data:font/woff2;base64,${b64})`;
      }),
  )
  .join("\n");
