import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceUrl = new URL("../../src/components/ui/ThemeLogo.jsx", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");
const portalSource = readFileSync(
  new URL("../../src/components/ClientPortal.jsx", import.meta.url),
  "utf8",
);
const adminLoginSource = readFileSync(
  new URL("../../src/components/admin/AdminLoginScreen.jsx", import.meta.url),
  "utf8",
);
const adminCss = readFileSync(
  new URL("../../src/components/AdminPanel.css", import.meta.url),
  "utf8",
);

const officialAssets = [
  {
    url: new URL("../../src/assets/images/brand-logo-monogram-light.png", import.meta.url),
    width: 1254,
    height: 1254,
    sha256: "76e35e9bd6b52bca95d8bfc9e393cb13e5812dbfe1ea5bc208f34da19c436fe9",
  },
  {
    url: new URL("../../src/assets/images/brand-logo-monogram-dark.png", import.meta.url),
    width: 1254,
    height: 1254,
    sha256: "4666fa1537a83a0ea17867efa541843c74299b9702dcd08c8c0dc437f5707177",
  },
  {
    url: new URL("../../src/assets/images/brand-logo-main-tagline.png", import.meta.url),
    width: 1536,
    height: 1024,
    sha256: "f80e7bcc059725e3409fdc59b80e152571c8e0ae59ebe1ef92d36450719c5999",
  },
];

test("ThemeLogo references only the official new TU identity", () => {
  assert.match(source, /brand-logo-monogram-light\.png/);
  assert.match(source, /brand-logo-monogram-dark\.png/);
  assert.match(source, /brand-logo-main-tagline\.png/);
  assert.doesNotMatch(source, /logo-(?:icon|full)-sin-fondo\.png/);
});

test("official assets are byte-identical to the supplied ZIP and keep their native ratio", async () => {
  for (const asset of officialAssets) {
    const assetPath = fileURLToPath(asset.url);
    const bytes = readFileSync(assetPath);
    const metadata = await sharp(bytes).metadata();

    assert.equal(metadata.width, asset.width);
    assert.equal(metadata.height, asset.height);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    assert.ok(statSync(assetPath).size > 0);
  }
});

test("ThemeLogo excludes ZIP files with a baked checkerboard", () => {
  assert.doesNotMatch(source, /Main_Logo_No_Tagline/);
  assert.doesNotMatch(source, /brand-logo-main-(?:light|dark)\.png/);
});

test("ThemeLogo keeps one rendered image and responds to the explicit app theme", () => {
  const imageTags = source.match(/\n\s*<img\b/g) ?? [];
  assert.equal(imageTags.length, 1);
  assert.match(source, /MutationObserver/);
  assert.match(source, /dataset\.theme/);
});

test("compact square surfaces use the monogram instead of shrinking the main lockup", () => {
  assert.match(portalSource, /<ThemeLogo\s+variant="monogram"/);
  assert.match(adminLoginSource, /<ThemeLogo\s+variant="monogram"/);
});

test("admin login constrains the monogram wrapper independently from global logo styles", () => {
  assert.match(adminLoginSource, /className="admin-login-brand-mark"/);
  assert.match(adminCss, /\.admin-login-brand-mark\s*\{[^}]*width:\s*clamp\(88px,\s*12vw,\s*112px\)/s);
  assert.match(adminCss, /\.admin-login-brand-mark\s*\{[^}]*aspect-ratio:\s*1/s);
  assert.match(adminCss, /\.admin-login-brand-mark \.admin-login-logo\s*\{[^}]*width:\s*100%/s);
  assert.match(adminCss, /\.admin-login-brand-mark \.admin-login-logo\s*\{[^}]*height:\s*100%/s);
});

test("full and tagline variants keep the stable supplied lockup in both themes", () => {
  assert.match(source, /variant === "monogram" \? MONOGRAM\[theme\] : MAIN_LOGO/);
});
