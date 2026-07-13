import { expect, test } from "@playwright/test";

const mockHealthyBookingApi = async (page) => {
  await page.route("**/health", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/bookings/availability**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );
};

test.describe("accessibility launcher keyboard behavior", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps keyboard focus inside its dialog and restores the launcher", async ({
    page,
  }) => {
    await mockHealthyBookingApi(page);
    await page.goto("/reservar");

    await expect(page.getByRole("heading", { name: /asegur/i })).toBeVisible({
      timeout: 60_000,
    });

    const launcher = page.getByRole("button", {
      name: "Abrir panel de accesibilidad",
    });
    await launcher.click();

    const closeButton = page.getByRole("button", {
      name: "Cerrar panel de accesibilidad",
    });
    const resetButton = page.getByRole("button", { name: "Restablecer" });

    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(resetButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
  });

  for (const width of [360, 390]) {
    test(`tracks only the active booking CTA at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await mockHealthyBookingApi(page);
      await page.goto("/reservar");

      await expect(page.getByRole("heading", { name: /asegur/i })).toBeVisible({
        timeout: 60_000,
      });

      await page.evaluate(() => {
        document
          .querySelectorAll(".form-slide-panel.active-panel")
          .forEach((panel) => {
            panel.classList.remove("active-panel");
            panel.setAttribute("aria-hidden", "true");
          });

        const fixture = document.createElement("div");
        fixture.id = "a11y-cta-fixture";
        fixture.innerHTML = `
          <section class="form-slide-panel" aria-hidden="true">
            <button class="field-flow-btn field-flow-next" style="display:none">Oculta</button>
          </section>
          <section class="form-slide-panel active-panel" aria-hidden="false">
            <button class="field-flow-btn field-flow-next">Visible</button>
          </section>
        `;
        const actions = fixture.querySelectorAll(".field-flow-next");
        actions[0].getBoundingClientRect = () => ({
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
        });
        actions[1].getBoundingClientRect = () => ({
          bottom: window.innerHeight,
          height: 52,
          left: 80,
          right: 280,
          top: window.innerHeight - 52,
          width: 200,
          x: 80,
          y: window.innerHeight - 52,
        });
        document.getElementById("main-content").prepend(fixture);
      });

      const lift = page.locator(".a11y-shell");
      await expect
        .poll(async () =>
          Number.parseFloat(
            (await lift.evaluate((element) =>
              element.style.getPropertyValue("--a11y-booking-action-lift"),
            )) || "0",
          ),
        )
        .toBeGreaterThan(0);

      await page.evaluate(() => {
        const panels = document.querySelectorAll(
          "#a11y-cta-fixture .form-slide-panel",
        );
        panels[1].classList.remove("active-panel");
        panels[1].setAttribute("aria-hidden", "true");
        panels[0].classList.add("active-panel");
        panels[0].setAttribute("aria-hidden", "false");
      });

      await expect
        .poll(async () =>
          Number.parseFloat(
            (await lift.evaluate((element) =>
              element.style.getPropertyValue("--a11y-booking-action-lift"),
            )) || "0",
          ),
        )
        .toBe(0);
    });
  }
});
