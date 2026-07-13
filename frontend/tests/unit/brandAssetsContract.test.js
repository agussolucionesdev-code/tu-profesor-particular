import assert from "node:assert/strict";
import { statSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceUrl = new URL("../../src/components/ui/ThemeLogo.jsx", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");

const transparentAssets = [
  new URL("../../src/assets/images/logo-icon-sin-fondo.png", import.meta.url),
  new URL("../../src/assets/images/logo-full-sin-fondo.png", import.meta.url),
];

test("ThemeLogo only references transparent brand assets", () => {
  assert.match(source, /logo-icon-sin-fondo\.png/);
  assert.match(source, /logo-full-sin-fondo\.png/);
  assert.doesNotMatch(source, /logo-(?:monogram|full)-(?:light|dark|tagline)\.png/);
});

test("the referenced brand assets have real alpha and a bounded transfer weight", async () => {
  let totalBytes = 0;

  for (const asset of transparentAssets) {
    const assetPath = fileURLToPath(asset);
    const metadata = await sharp(assetPath).metadata();
    totalBytes += statSync(assetPath).size;
    assert.equal(metadata.hasAlpha, true, `${asset.pathname} must have alpha`);
  }

  assert.ok(totalBytes < 1_100_000, `brand payload is ${totalBytes} bytes`);
});

test("ThemeLogo renders one image instead of preloading hidden theme duplicates", () => {
  const imageTags = source.match(/\n\s*<img\b/g) ?? [];
  assert.equal(imageTags.length, 1);
});
