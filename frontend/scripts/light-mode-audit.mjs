import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "C:/Develop_webs/Tu_Profesor_Particular_Gestión_Turnos/artifacts/dark-mode-audit";
const BASE = "http://127.0.0.1:4178";

const ensureDir = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
};

const shot = async (page, name) => {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: "disabled", timeout: 15000 });
  console.log(`→ ${name}.png`);
};

const run = async () => {
  await ensureDir();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });

  await ctx.addInitScript(() => {
    localStorage.setItem("theme", "light");
    localStorage.setItem("muted_alerts", "true");
    localStorage.setItem("voice_hint_seen", "true");
  });

  const page = await ctx.newPage();

  await page.goto(`${BASE}/reservar`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const toggleAdulto = page.locator(".neuro-toggle-wrapper").first();
  if (await toggleAdulto.count()) {
    await toggleAdulto.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  await page.locator('input[name="studentName"]').fill("Agustín Sosa Test");
  await page.locator('input[name="phone"]').fill("+54 9 11-2222-3333");
  await page.locator('input[name="email"]').fill("test@example.com").catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('select[name="educationLevel"]').selectOption("Universitario").catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('select[name="yearGrade"]').selectOption({ index: 1 }).catch(() => {});
  await page.locator('input[name="subject"]').fill("Matemática discreta").catch(() => {});
  await page.locator('input[name="school"]').fill("UBA - FCEN").catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, "l01-step1-light");

  const continuarBtn = page.locator("button", { hasText: /continuar/i }).first();
  await continuarBtn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "l02-step2-calendar-light");

  const cal = page.locator(".react-datepicker, .calendar-glass-box").first();
  if (await cal.count()) {
    await cal.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    const box = await cal.boundingBox().catch(() => null);
    if (box) {
      await page.screenshot({
        path: path.join(OUT_DIR, "l02c-calendar-zoom-light.png"),
        clip: {
          x: Math.max(0, box.x - 40),
          y: Math.max(0, box.y - 40),
          width: Math.min(1440, box.width + 80),
          height: Math.min(900, box.height + 80),
        },
        animations: "disabled",
      });
      console.log("→ l02c-calendar-zoom-light.png");
    }
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
