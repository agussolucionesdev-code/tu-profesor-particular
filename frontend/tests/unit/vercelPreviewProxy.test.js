import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiClientSource = await readFile(
  new URL("../../src/api/apiClient.js", import.meta.url),
  "utf8",
);
const vercelConfig = JSON.parse(
  await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
);

test("Vercel deployments use their own origin as the API base", () => {
  assert.match(apiClientSource, /hostname\?\.endsWith\("\.vercel\.app"\)/);
  assert.match(
    apiClientSource,
    /const API_BASE = isVercelDeployment\s*\? globalThis\.location\.origin/,
  );
});

test("Vercel proxies health and API requests before the SPA fallback", () => {
  assert.deepEqual(vercelConfig.rewrites.slice(0, 2), [
    {
      source: "/health",
      destination:
        "https://tu-profesor-particular-backend.onrender.com/health",
    },
    {
      source: "/api/(.*)",
      destination:
        "https://tu-profesor-particular-backend.onrender.com/api/$1",
    },
  ]);
  assert.equal(vercelConfig.rewrites.at(-1).destination, "/index.html");
});
