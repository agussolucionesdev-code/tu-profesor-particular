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

const mockHealthyBackend = async (page) => {
  await page.route("**/health", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
};

test.describe("guided booking shell", () => {
  test.beforeEach(async ({ page }) => {
    await mockAvailability(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("starts in light mode with voice paused by default", async ({ page }) => {
    await mockHealthyBackend(page);
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
    await mockHealthyBackend(page);
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
    await mockHealthyBackend(page);
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

  test("exposes wizard progress without nesting controls in the progressbar", async ({
    page,
  }) => {
    await mockHealthyBackend(page);
    await page.goto("/reservar");
    await waitForBookingReady(page);

    const progress = page.getByRole("progressbar", {
      name: "Progreso de reserva",
    });
    await expect(progress).toHaveAttribute("aria-valuetext", /Paso 1 de 3/i);
    await expect(progress.getByRole("button")).toHaveCount(0);
  });

  test("explains the booking expectations before asking for personal data", async ({
    page,
  }) => {
    await mockHealthyBackend(page);
    await page.goto("/reservar");
    await waitForBookingReady(page);

    const expectations = page.getByRole("region", {
      name: "Antes de reservar",
    });
    await expect(expectations).toBeVisible();
    await expect(expectations).toContainText(/online y presencial/i);
    await expect(expectations).toContainText("Temperley");
    await expect(expectations).toContainText("Primera clase de diagnóstico");
    await expect(expectations).toContainText(/reprogramá o cancelá/i);

    const expectationsBox = await expectations.boundingBox();
    const studentNameBox = await page
      .getByRole("textbox", { name: /Nombre del alumno/i })
      .boundingBox();
    expect(expectationsBox?.y).toBeLessThan(studentNameBox?.y ?? 0);
  });

  test("associates required fields with their validation errors", async ({
    page,
  }) => {
    await mockHealthyBackend(page);
    await page.goto("/reservar");
    await waitForBookingReady(page);

    const studentName = page.getByRole("textbox", {
      name: /Nombre del alumno/i,
    });
    await expect(studentName).toHaveAttribute("required", "");
    await expect(studentName).toHaveAttribute("aria-required", "true");

    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.locator("#studentName-error")).toBeVisible();
    await expect(studentName).toHaveAttribute(
      "aria-describedby",
      /studentName-error/,
    );
  });
});

test.describe("application resilience and navigation", () => {
  test("keeps the landing visible while health is unavailable", async ({ page }) => {
    await page.route("**/health", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/");

    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("En mantenimiento", { exact: true })).toHaveCount(0);
  });

  test("moves focus to main content after client-side navigation", async ({ page }) => {
    await mockHealthyBackend(page);
    await page.goto("/");
    await page.locator(".hp-cta-main").first().click();
    await waitForBookingReady(page);
    await page.goBack();

    await expect(page.locator("#main-content")).toBeFocused();
  });
});

test.describe("mobile admin accessibility launcher", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("clears the fixed admin navigation with very large text and safe area", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("adminToken", "e2e-token");
      window.localStorage.setItem(
        "ui_accessibility_preferences",
        JSON.stringify({ themePreference: "light", fontScale: "xlarge" }),
      );
    });
    await mockHealthyBackend(page);
    await page.route("http://localhost:3000/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );

    await page.goto("/admin");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "24px");
    });
    const launcher = page.locator(".a11y-fab");
    const bottomNav = page.locator(".admin-bottom-nav");
    await expect(launcher).toBeVisible();
    await expect(bottomNav).toBeVisible();

    const boxes = await Promise.all([
      launcher.boundingBox(),
      bottomNav.boundingBox(),
    ]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();
    expect(boxes[0].y + boxes[0].height).toBeLessThanOrEqual(boxes[1].y - 8);
  });
});
