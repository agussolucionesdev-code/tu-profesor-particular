import { expect, test } from "@playwright/test";

test("does not invent booking times when the backend omits authoritative slots", async ({ page }) => {
  await page.route("**/health", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/bookings/availability**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], blockedDates: [] }),
    }),
  );

  await page.goto("/reservar");
  await expect(page.getByRole("heading", { name: /asegur/i })).toBeVisible();

  await expect(page.locator(".calendar-no-availability")).toContainText(
    "No pudimos cargar la agenda",
  );
  await expect(page.locator(".slot-btn")).toHaveCount(0);
  await expect(page.locator(".btn-date-next")).toBeDisabled();
});
