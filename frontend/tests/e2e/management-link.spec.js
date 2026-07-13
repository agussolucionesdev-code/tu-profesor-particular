import { expect, test } from "@playwright/test";

const token = "a".repeat(43);

test.use({ timezoneId: "America/Argentina/Buenos_Aires" });

const mockHealth = async (page) => {
  await page.route("**/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    }),
  );
};

test.describe("secure booking management links", () => {
  test("consumes the hash token once and sends it only in the management header", async ({
    page,
  }) => {
    await mockHealth(page);
    let managementRequest;
    await page.route("**/api/bookings/manage", async (route) => {
      managementRequest = route.request();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            bookingCode: "SAFE123",
            studentName: "Alumno Seguro",
            subject: "Matemática",
            duration: 1,
            status: "Confirmado",
            timeSlot: "2030-06-15T15:00:00.000Z",
            endTime: "2030-06-15T16:00:00.000Z",
          },
        }),
      });
    });

    await page.goto(`/m#token=${token}`);

    await expect(page.getByRole("heading", { name: /gestioná tu turno/i })).toBeVisible();
    await expect(page.getByText("Alumno Seguro")).toBeVisible();
    expect(managementRequest.headers()["x-booking-manage-token"]).toBe(token);
    expect(managementRequest.url()).not.toContain(token);
    expect(await page.evaluate(() => window.location.hash)).toBe("");
    expect(await page.evaluate((managementToken) => {
      const storageValues = [
        ...Object.values(localStorage),
        ...Object.values(sessionStorage),
      ];
      return storageValues.some((value) => value.includes(managementToken));
    }, token)).toBe(false);
    expect(await page.locator("body").innerText()).not.toContain(token);
  });

  test("does not call the API when the management fragment is missing or invalid", async ({
    page,
  }) => {
    await mockHealth(page);
    let calls = 0;
    await page.route("**/api/bookings/manage", async (route) => {
      calls += 1;
      await route.fulfill({ status: 401, body: "{}" });
    });

    await page.goto("/m#token=invalid");

    await expect(page.getByRole("heading", { name: /enlace no disponible/i })).toBeVisible();
    expect(calls).toBe(0);
  });

  test("keeps the current time when changing duration if the management token authorizes it", async ({
    page,
  }) => {
    await mockHealth(page);
    const timeSlot = "2030-06-15T15:00:00.000Z";
    const endTime = "2030-06-15T16:00:00.000Z";
    const availabilityHeaders = [];

    await page.route("**/api/bookings/manage", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            bookingCode: "SAFE123",
            studentName: "Alumno Seguro",
            subject: "Matemática",
            duration: 1,
            status: "Confirmado",
            timeSlot,
            endTime,
          },
        }),
      }),
    );
    await page.route("**/api/bookings/availability?**", async (route) => {
      const tokenHeader = route.request().headers()["x-booking-manage-token"];
      availabilityHeaders.push(tokenHeader);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          blockedDates: [],
          schedule: { timeZone: "America/Argentina/Buenos_Aires" },
          // The backend includes this time only for the bearer that owns it.
          // Without the header, a duration change would correctly clear it.
          slots: tokenHeader === token ? [{ timeSlot, endTime, duration: 1.5 }] : [],
        }),
      });
    });

    await page.goto(`/m#token=${token}`);
    await page.getByRole("button", { name: /reprogramar turno de alumno seguro/i }).click();
    await page.locator(".reschedule-duration-btn", { hasText: "1 h 30 min" }).click();

    await expect(page.locator(".reschedule-slot-btn[aria-pressed='true']")).toHaveCount(1);
    expect(availabilityHeaders.length).toBeGreaterThanOrEqual(2);
    expect(availabilityHeaders.every((value) => value === token)).toBe(true);
  });
});
