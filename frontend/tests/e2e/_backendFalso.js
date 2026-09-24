/* Un backend mínimo, interceptado en el navegador.
 *
 * La app pregunta por `GET /health` de fondo y, si tras varios intentos no
 * contesta, manda toda ruta menos `/` a la pantalla de mantenimiento (ver
 * src/hooks/useEstadoDelServidor.js). Sin un backend que conteste, un spec
 * largo de `/reservar` o `/portal` podía terminar midiendo el cartel de "en
 * mantenimiento" y pasar igual, porque un cartel no tiene fallas de contraste.
 *
 * Levantar el backend de verdad en CI cuesta el arranque de mongodb-memory-server
 * (unos 100 segundos) para verificar cosas que son puramente de front. Con esto,
 * los specs de accesibilidad corren en cualquier máquina y en cualquier CI sin
 * más dependencia que el navegador.
 *
 * Lo que se devuelve es deliberadamente el mínimo: si algún día un spec necesita
 * datos que no están acá, va a fallar de forma visible en vez de medir una
 * pantalla vacía.
 */

/* NO se simula `GET /api/bookings/availability`, y es deliberado.
 *
 * Su respuesta tiene una forma que el hook parsea y enriquece, y replicarla acá
 * significaría mantener dos veces el mismo contrato. El día que el backend
 * cambie, el mock seguiría devolviendo la forma vieja y los specs pasarían
 * validando contra una mentira, que es peor que no tenerlos.
 *
 * Los dos specs que necesitan el calendario cargado se saltean solos cuando no
 * hay backend, con el motivo a la vista. Corren en local con `npm run dev` del
 * backend levantado, que es donde tiene sentido ejercitar ese contrato. */
export const hayBackend = async () => {
  try {
    const r = await fetch("http://127.0.0.1:4100/health", {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
};

export const instalarBackendFalso = async (page) => {
  await page.route("**/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "success", database: { isConnected: true } }),
    }),
  );

  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          "schedule.timeZone": "America/Argentina/Buenos_Aires",
          "schedule.slotDurationMinutes": 30,
          "schedule.advanceNoticeMinutes": 60,
          "schedule.maximumAdvanceDays": 120,
          "booking.pricePerHour": 20000,
          "booking.pricingMatrix": null,
          "booking.subjectsByLevel": null,
          "teacher.address": "Jujuy 414, Temperley, Buenos Aires",
        },
      }),
    }),
  );
};
