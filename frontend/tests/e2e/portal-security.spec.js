import { expect, test } from "@playwright/test";

const booking = ({
  id,
  code,
  status,
  timeSlot,
  endTime,
  studentName,
}) => ({
  _id: id,
  bookingCode: code,
  status,
  timeSlot,
  endTime,
  studentName,
  subject: "Matemática",
  duration: 1,
  responsibleRelationship: "self",
});

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

  test("accepts only an exact booking code and does not query by email", async ({
    page,
  }) => {
    let lookupRequests = 0;
    await page.route("**/api/bookings/**", async (route) => {
      lookupRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/portal");

    await expect(
      page.getByText(/por seguridad.*código de reserva exacto/i),
    ).toBeVisible();
    await page.getByLabel(/código de reserva exacto/i).fill("alumno@example.com");
    await page.getByRole("button", { name: /buscar mis turnos/i }).click();

    await expect(page.getByRole("alert")).toContainText(
      /ingresá un código de reserva válido/i,
    );
    expect(lookupRequests).toBe(0);
  });

  test("keeps finalized and cancelled history strictly read-only", async ({
    page,
  }) => {
    const historicalBookings = [
      booking({
        id: "final-1",
        code: "FINAL123",
        status: "Finalizado",
        timeSlot: "2025-01-10T15:00:00.000Z",
        endTime: "2025-01-10T16:00:00.000Z",
        studentName: "Alumno Finalizado",
      }),
      booking({
        id: "cancel-1",
        code: "CANCEL12",
        status: "Cancelado",
        timeSlot: "2025-01-11T15:00:00.000Z",
        endTime: "2025-01-11T16:00:00.000Z",
        studentName: "Alumno Cancelado",
      }),
    ];

    await page.route("**/api/bookings/FINAL123", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: historicalBookings }),
      }),
    );

    await page.goto("/portal");
    await page.getByLabel(/código de reserva exacto/i).fill("FINAL123");
    await page.getByRole("button", { name: /buscar mis turnos/i }).click();
    await page.getByRole("button", { name: /ver historial/i }).click();

    const history = page.locator(".tickets-grid--history");
    await expect(history.getByText("Alumno Finalizado")).toBeVisible();
    await expect(history.getByText("Alumno Cancelado")).toBeVisible();
    await expect(
      history.getByRole("button", {
        name: /reprogramar|cancelar|confirmar asistencia|ocultar/i,
      }),
    ).toHaveCount(0);
    await expect(history.locator("textarea")).toHaveCount(0);
  });

  test("announces informational search results without error semantics", async ({
    page,
  }) => {
    await page.route("**/api/bookings/INFO123", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            booking({
              id: "past-1",
              code: "INFO123",
              status: "Finalizado",
              timeSlot: "2025-01-10T15:00:00.000Z",
              endTime: "2025-01-10T16:00:00.000Z",
              studentName: "Alumno Histórico",
            }),
          ],
        }),
      }),
    );

    await page.goto("/portal");
    await page.getByLabel(/código de reserva exacto/i).fill("INFO123");
    await page.getByRole("button", { name: /buscar mis turnos/i }).click();

    const status = page.getByRole("status").filter({
      hasText: /ese turno ya no está activo/i,
    });
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/portal-message--info/);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("announces a successful cancellation as success", async ({ page }) => {
    const future = new Date(Date.now() + 86_400_000);
    const futureEnd = new Date(future.getTime() + 3_600_000);

    await page.route("**/api/bookings/ACTIVE12", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: booking({
            code: "ACTIVE12",
            status: "Confirmado",
            timeSlot: future.toISOString(),
            endTime: futureEnd.toISOString(),
            studentName: "Alumno Activo",
          }),
        }),
      }),
    );
    await page.route("**/api/bookings/cancel", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: {} }),
      }),
    );

    await page.goto("/portal");
    await page.getByLabel(/código de reserva exacto/i).fill("ACTIVE12");
    await page.getByRole("button", { name: /buscar mis turnos/i }).click();
    await expect(page.locator("textarea")).toHaveCount(0);
    await page.getByRole("button", { name: /cancelar turno de alumno activo/i }).click();
    await page.getByRole("button", { name: /^sí, liberar horario$/i }).click();

    const status = page.getByRole("status").filter({
      hasText: /el turno se canceló correctamente/i,
    });
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/portal-message--success/);
  });
});
