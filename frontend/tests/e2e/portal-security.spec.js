import { expect, test } from "@playwright/test";

const mockAppHealth = async (page) => {
  await page.route("**/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    }),
  );
};

test.describe("portal security containment", () => {
  test.beforeEach(async ({ page }) => {
    await mockAppHealth(page);
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("requests a private management link and never looks up booking data by code", async ({
    page,
  }) => {
    const publicLookupRequests = [];
    let recoveryPayload;

    await page.route("**/api/bookings/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (
        request.method() === "POST" &&
        url.pathname === "/api/bookings/manage/request-link"
      ) {
        recoveryPayload = request.postDataJSON();
        return route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message:
              "Si los datos coinciden con una reserva, vas a recibir un enlace seguro por email.",
          }),
        });
      }

      publicLookupRequests.push({ method: request.method(), path: url.pathname });
      return route.fulfill({ status: 500, body: "{}" });
    });

    await page.goto("/portal");

    await expect(
      page.getByRole("heading", { name: /acceso seguro a tus turnos/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /buscar mis turnos/i }),
    ).toHaveCount(0);

    await page.getByLabel(/código de reserva/i).fill("safe123");
    await page.getByLabel(/email usado al reservar/i).fill("familia@example.com");
    await page.getByRole("button", { name: /enviar enlace seguro/i }).click();

    await expect(page.getByRole("status")).toContainText(
      /si los datos coinciden.*enlace seguro por email/i,
    );
    expect(recoveryPayload).toEqual({
      bookingCode: "SAFE123",
      email: "familia@example.com",
    });
    expect(publicLookupRequests).toEqual([]);
    expect(await page.locator("body").innerText()).not.toContain("Alumno Privado");
  });

  test("shows the same privacy-preserving result when recovery fails", async ({
    page,
  }) => {
    await page.route("**/api/bookings/manage/request-link", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false }),
      }),
    );

    await page.goto("/portal");
    await page.getByLabel(/código de reserva/i).fill("MISSING1");
    await page.getByLabel(/email usado al reservar/i).fill("nadie@example.com");
    await page.getByRole("button", { name: /enviar enlace seguro/i }).click();

    await expect(page.getByRole("status")).toContainText(
      /si los datos coinciden.*enlace seguro por email/i,
    );
    await expect(page.getByText(/no encontramos|reserva inexistente/i)).toHaveCount(0);
  });
});
