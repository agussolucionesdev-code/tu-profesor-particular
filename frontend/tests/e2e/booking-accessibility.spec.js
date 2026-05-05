import { expect, test } from "@playwright/test";

const mockAvailability = async (page) => {
  await page.route("**/api/bookings/availability**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
};

const waitForBookingReady = async (page) => {
  await expect(page.getByRole("heading", { name: /asegur/i })).toBeVisible({
    timeout: 60_000,
  });
};

test.describe("guided booking shell", () => {
  test.beforeEach(async ({ page }) => {
    await mockAvailability(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("starts in light mode with voice paused by default", async ({ page }) => {
    await page.goto("/reservar");

    await waitForBookingReady(page);
    // Voice is muted by default: button has class "muted" and aria-label indicates activation
    await expect(page.locator(".voice-toggle-btn.muted")).toBeVisible();
    await expect(page.locator(".voice-toggle-btn")).toHaveAttribute(
      "aria-label",
      "Activar guía por voz",
    );

    const theme = await page.evaluate(
      () => document.documentElement.dataset.themePreference,
    );
    expect(theme).toBe("light");
  });

  test("keeps inactive wizard panels out of the accessibility path", async ({
    page,
  }) => {
    await page.goto("/reservar");

    await waitForBookingReady(page);
    await expect(page.locator(".form-slide-panel.active-panel")).toHaveCount(1);

    const hiddenPanels = await page.locator(".form-slide-panel[aria-hidden='true']").evaluateAll(
      (panels) =>
        panels.map((panel) => ({
          inert: panel.inert,
          focusableCount: panel.querySelectorAll(
            "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ).length,
        })),
    );

    expect(hiddenPanels.length).toBeGreaterThan(0);
    expect(hiddenPanels.every((panel) => panel.inert)).toBe(true);
  });

  test("accessibility controls can switch dark mode and larger text", async ({
    page,
  }) => {
    await page.goto("/reservar");

    await waitForBookingReady(page);
    await page.locator(".a11y-fab").click();
    await expect(page.locator("#a11y-panel")).toBeVisible();
    await page.evaluate(() => {
      const chips = document.querySelectorAll("#a11y-panel .a11y-chip");
      chips[2]?.click();
      chips[4]?.click();
    });

    const prefs = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      fontScale: document.documentElement.dataset.fontScale,
    }));

    expect(prefs.theme).toBe("dark");
    expect(["large", "xlarge"]).toContain(prefs.fontScale);
  });
});
