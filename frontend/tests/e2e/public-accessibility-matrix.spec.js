import { expect, test } from "@playwright/test";

const viewports = [360, 390, 768, 1024, 1440];
const themes = ["light", "dark"];

const openLanding = async (page, theme) => {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("theme", selectedTheme);
  }, theme);
  await page.goto("/");
  await expect(page.locator("main#main-content")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
};

const expectPublicAccessibilityContract = async (page) => {
  expect(await page.locator("img:not([alt])").count()).toBe(0);

  for (const control of await page.locator("button:visible, a:visible").all()) {
    await expect(control).toHaveAccessibleName(/\S/);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
};

test.describe.configure({ mode: "serial" });

for (const width of viewports) {
  for (const theme of themes) {
    test(`landing contract at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openLanding(page, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectPublicAccessibilityContract(page);
    });
  }
}

for (const textZoom of [200, 400]) {
  test(`public content remains operable at ${textZoom}% text zoom`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLanding(page, "light");
    await page.evaluate((zoom) => {
      document.documentElement.style.fontSize = `${zoom}%`;
    }, textZoom);
    await expectPublicAccessibilityContract(page);
    await expect(page.getByRole("link", { name: /reservar/i }).first()).toBeVisible();
  });
}
