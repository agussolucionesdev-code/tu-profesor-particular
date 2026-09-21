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
  assert.match(source, /brand-logo-monogram-light-168\.png/);
  assert.match(source, /brand-logo-monogram-dark-168\.png/);
  assert.match(source, /brand-logo-main-tagline\.png/);
  assert.doesNotMatch(source, /logo-(?:icon|full)-sin-fondo\.png/);
});

/* Los originales de 1254 px quedan en el repo porque son la fuente de los
   derivados (y los fija el test de abajo), pero la app no los importa: el
   monograma se dibuja entre 32 y 112 px, y servir 1254 era bajar 850 KB para
   pintar 38. */
test("ThemeLogo never ships the 1254 px monogram originals", () => {
  assert.doesNotMatch(source, /brand-logo-monogram-(?:light|dark)\.png/);
});

const derivedMonograms = ["light", "dark"].flatMap((tone) =>
  [
    { side: 168, maxBytes: 8 * 1024 },
    { side: 336, maxBytes: 24 * 1024 },
  ].map(({ side, maxBytes }) => ({
    tone,
    side,
    maxBytes,
    url: new URL(`../../src/assets/images/brand-logo-monogram-${tone}-${side}.png`, import.meta.url),
  })),
);

test("derived monograms are square palette PNGs sized for DPR 3 within budget", async () => {
  for (const asset of derivedMonograms) {
    const bytes = readFileSync(fileURLToPath(asset.url));
    const metadata = await sharp(bytes).metadata();
    const label = `${asset.tone}-${asset.side}`;

    assert.equal(metadata.format, "png", label);
    assert.equal(metadata.width, asset.side, label);
    assert.equal(metadata.height, asset.side, label);
    assert.ok(metadata.isPalette, `${label} debería ser PNG de paleta`);
    assert.ok(bytes.length <= asset.maxBytes, `${label} pesa ${bytes.length} bytes`);
  }
});

test("derived monograms have real transparency instead of a baked background", async () => {
  for (const asset of derivedMonograms) {
    const { data, info } = await sharp(fileURLToPath(asset.url))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const label = `${asset.tone}-${asset.side}`;
    const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
    const last = asset.side - 1;

    for (const [x, y] of [[0, 0], [last, 0], [0, last], [last, last]]) {
      assert.equal(alphaAt(x, y), 0, `${label} esquina ${x},${y}`);
    }

    let transparent = 0;
    let opaque = 0;
    let opaqueLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) transparent++;
      if (data[i + 3] === 255) {
        opaque++;
        opaqueLuma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
    }
    const pixels = info.width * info.height;
    assert.ok(transparent / pixels > 0.75, `${label}: ${transparent} transparentes de ${pixels}`);
    assert.ok(opaque / pixels > 0.05, `${label}: ${opaque} opacos de ${pixels}`);

    /* La variante clara lleva el trazo navy (para fondos claros) y la oscura el
       blanco (para fondos oscuros). Si se cruzan, el logo desaparece. */
    const meanLuma = opaqueLuma / opaque;
    if (asset.tone === "light") assert.ok(meanLuma < 110, `${label} luma ${meanLuma}`);
    else assert.ok(meanLuma > 170, `${label} luma ${meanLuma}`);
  }
});

const themeLogoBlocks = (file) =>
  readFileSync(new URL(file, import.meta.url), "utf8").match(/<ThemeLogo\b[\s\S]*?\/>/g) ?? [];

const blockWith = (file, marker) => {
  const block = themeLogoBlocks(file).find((candidate) => candidate.includes(marker));
  assert.ok(block, `${file} debería tener un ThemeLogo con ${marker}`);
  return block;
};

/* Con alfa, el tema de la app ya no alcanza para elegir variante: el footer, el
   CTA de la home y el encabezado del éxito de reserva son navy en los dos
   temas, y la caja del loader es clara en los dos. Quien dibuja el logo sobre
   una superficie que no sigue el tema tiene que declararla. */
test("logos on surfaces that ignore the theme declare their surface", () => {
  assert.match(themeLogoBlocks("../../src/layouts/Footer.jsx")[0] ?? "", /surface="dark"/);
  assert.match(blockWith("../../src/pages/HomePage.jsx", "hp-cta-monogram"), /surface="dark"/);
  assert.match(blockWith("../../src/pages/HomePage.jsx", "hp-web-logo"), /surface="dark"/);
  assert.match(
    blockWith("../../src/components/booking/BookingSuccessModal.jsx", "success-brand-mark"),
    /surface="dark"/,
  );
  assert.match(blockWith("../../src/components/ui/BrandLoader.jsx", "brand-loader-logo"), /surface="light"/);
});

test("the admin login announces its larger monogram so DPR 3 gets the 336 px file", () => {
  assert.match(blockWith("../../src/components/admin/AdminLoginScreen.jsx", "admin-login-logo"), /sizes="112px"/);
});

/* La marca de agua del cierre de la home midió 0 px desde julio sin que nadie lo
   notara. La regla `.hp-cta-inner > *:not(.hp-cta-monogram)` sube a todo el
   contenido por encima de la marca, pero el hijo directo es el <span> de
   ThemeLogo, y la clase estaba en el <img> de adentro. El span recibía
   `position: relative`, quedaba de contenedor del img absoluto y, sin contenido
   en flujo, medía 0; el `max-width: 100%` del img resolvía contra ese 0. Por
   eso la clase va en el envoltorio y el img lo llena. */
test("the home watermark class sits on the direct child the CSS excludes", () => {
  const watermark = blockWith("../../src/pages/HomePage.jsx", "hp-cta-monogram");
  assert.match(watermark, /\bclassName="hp-cta-monogram"/);
  assert.doesNotMatch(watermark, /imgClassName="hp-cta-monogram"/);
  assert.match(watermark, /sizes="560px"/);
  assert.match(watermark, /loading="lazy"/);

  const homeCss = readFileSync(new URL("../../src/pages/HomePage.css", import.meta.url), "utf8");
  assert.match(homeCss, /\.hp-cta-inner > \*:not\(\.hp-cta-monogram\)/);
  assert.match(homeCss, /\.hp-cta-monogram \.theme-logo__image\s*\{[^}]*width:\s*100%/s);
});

test("the maintenance brand no longer disguises an opaque background", () => {
  const maintenanceCss = readFileSync(
    new URL("../../src/components/errors/MaintenancePage.css", import.meta.url),
    "utf8",
  );
  const brandRule = maintenanceCss.match(/\.error-page--mantenimiento \.error-page-brand img\s*\{[^}]*\}/);
  assert.equal(brandRule, null);
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
  assert.match(source, /variant === "monogram" \? MONOGRAM\[tone\] : MAIN_LOGO/);
});
