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

const fullShot = async (page, name) => {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 20000 });
  console.log(`→ ${name}.png (full)`);
};

const run = async () => {
  await ensureDir();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });

  await ctx.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("muted_alerts", "true");
    localStorage.setItem("voice_hint_seen", "true");
  });

  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER ERR:", msg.text());
  });

  await page.goto(`${BASE}/reservar`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // Step 1: toggle adult mode ON so we skip responsable fields
  const toggleAdulto = page.locator(".neuro-toggle-wrapper").first();
  if (await toggleAdulto.count()) {
    await toggleAdulto.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  await page.locator('input[name="studentName"]').fill("Agustín Sosa Test");
  await page.locator('input[name="phone"]').fill("+54 9 11-2222-3333");
  await page.locator('input[name="email"]').fill("test@example.com").catch(() => {});

  await page.waitForTimeout(600);

  // Academic section (should be unlocked once personal info is complete)
  await page.locator('select[name="educationLevel"]').selectOption("Universitario").catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('select[name="yearGrade"]').selectOption({ index: 1 }).catch(() => {});
  await page.locator('input[name="subject"]').fill("Matemática discreta").catch(() => {});
  await page.locator('input[name="school"]').fill("UBA - FCEN").catch(() => {});

  await page.waitForTimeout(600);
  await shot(page, "a01-step1-filled");

  // Click "Continuar" button
  const continuarBtn = page.locator("button", { hasText: /continuar/i }).first();
  await continuarBtn.click({ timeout: 8000 }).catch((e) => console.log("continuar err:", e.message));
  await page.waitForTimeout(1500);
  await shot(page, "a02-step2-calendar");
  await fullShot(page, "a02b-step2-full");

  // Screenshot focusing the calendar area
  const cal = page.locator(".react-datepicker, .calendar-glass-box").first();
  if (await cal.count()) {
    await cal.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    const box = await cal.boundingBox().catch(() => null);
    if (box) {
      await page.screenshot({
        path: path.join(OUT_DIR, "a02c-calendar-zoom.png"),
        clip: {
          x: Math.max(0, box.x - 40),
          y: Math.max(0, box.y - 40),
          width: Math.min(1440, box.width + 80),
          height: Math.min(900, box.height + 80),
        },
        animations: "disabled",
      });
      console.log("→ a02c-calendar-zoom.png");
    }
  }

  // Try to click a date — use force to bypass visibility checks
  const dayCell = page
    .locator(".react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--outside-month)")
    .first();
  if (await dayCell.count()) {
    await dayCell.click({ force: true, timeout: 5000 }).catch((e) => console.log("day click err:", e.message));
    await page.waitForTimeout(800);
    await shot(page, "a03-date-selected");
  }

  // Click continuar again to reach step 3 (horarios)
  const continuar2 = page.locator("button", { hasText: /continuar/i }).first();
  await continuar2.click({ timeout: 8000 }).catch((e) => console.log("continuar2 err:", e.message));
  await page.waitForTimeout(1500);
  await shot(page, "a04-step3-horarios");
  await fullShot(page, "a04b-step3-full");

  // Screenshot of month navigation
  const monthHeader = page.locator(".react-datepicker__current-month, .react-datepicker__header");
  if (await monthHeader.count()) {
    await monthHeader.first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, "a05-month-header-dark");
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
