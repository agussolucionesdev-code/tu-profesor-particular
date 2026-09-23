import { expect, test } from "@playwright/test";

import { hayBackend, instalarBackendFalso } from "./_backendFalso.js";
import { MANCHAS, informe, informeManchas, prepararYMedir } from "./_medidores.js";

/* EL MODO OSCURO, PANTALLA POR PANTALLA Y ESTADO POR ESTADO.
 *
 * Agustín mandó una captura del paso 1 del kiosco en oscuro: después de elegir
 * la materia aparecía un recuadro menta con el texto blanco encima, ilegible.
 * `contraste.spec.js` nunca lo vio porque mide el ESTADO INICIAL de tres rutas,
 * y el recuadro sólo existe después de elegir.
 *
 * Este spec recorre los estados: el kiosco paso a paso (con búsqueda, CBC y
 * materia escrita a mano), el portal con un turno cargado y sus dos modales,
 * los errores, el acceso del profesor y el panel. En cada uno mide dos cosas:
 *
 *   · manchas claras: recuadros de fondo claro en medio de la página oscura;
 *   · contraste de texto AA, con el mismo medidor que contraste.spec.js.
 *
 * Y exige que haya medido: un estado que no se alcanzó no puede pasar en verde.
 */

const AHORA = Date.now();
const EN_DOS_DIAS = new Date(AHORA + 2 * 864e5);
EN_DOS_DIAS.setHours(15, 0, 0, 0);
const TURNO = {
  _id: "t1",
  bookingCode: "A3K9PQ",
  studentName: "Camila Duarte",
  subject: "Matemática",
  level: "Secundaria",
  modality: "online",
  duration: 1,
  status: "confirmed",
  email: "familia@example.com",
  phone: "1123456789",
  timeSlot: EN_DOS_DIAS.toISOString(),
  endTime: new Date(EN_DOS_DIAS.getTime() + 36e5).toISOString(),
};

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const instalarPortal = async (page) => {
  await page.route("**/api/bookings/portal/session", (r) => json(r, { success: true, data: { managementToken: "t" } }));
  await page.route("**/api/bookings/portal/history", (r) =>
    json(r, { success: true, data: { bookings: [TURNO], current: TURNO.bookingCode } }),
  );
  await page.route("**/api/bookings/availability**", (r) =>
    json(r, {
      success: true,
      data: {
        slots: [],
        schedule: { timeZone: "America/Argentina/Buenos_Aires" },
        range: { from: new Date(AHORA).toISOString(), to: new Date(AHORA + 30 * 864e5).toISOString() },
      },
    }),
  );
};

const medir = async (page, estado) => {
  const texto = await prepararYMedir(page);
  const { medidos, manchas } = await page.evaluate(MANCHAS);
  expect(texto.medidos, `${estado}: el barrido de texto no midió nada`).toBeGreaterThan(10);
  expect(medidos, `${estado}: el barrido de fondos no midió nada`).toBeGreaterThan(5);
  const problemas = [
    manchas.length ? `MANCHAS CLARAS (${manchas.length}):\n${informeManchas(manchas)}` : "",
    texto.fallas.length ? `CONTRASTE (${texto.fallas.length}):\n${informe(texto.fallas)}` : "",
  ].filter(Boolean);
  /* Soft: un estado con fallas no corta el recorrido, y el informe muestra
     todos los estados de una vez en lugar de sólo el primero. */
  expect.soft(problemas, `\n${estado}\n${problemas.join("\n")}\n`).toEqual([]);
};

const oscuro = (page) =>
  page.addInitScript(() =>
    localStorage.setItem("ui_accessibility_preferences", JSON.stringify({ themePreference: "dark", version: 2 })),
  );

const porNombre = (page, n) => page.getByRole("button", { name: n });
const continuar = (page) => page.getByRole("button", { name: /^Continuar/ }).click();

const alPaso1 = async (page) => {
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Ahora no/ }).click({ timeout: 3000 }).catch(() => {});
  await porNombre(page, /^Para otra persona/).click({ timeout: 60_000 });
};

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await oscuro(page);
  await instalarBackendFalso(page);
});

test("portada", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await medir(page, "portada");
});

test("kiosco · paso 1 sin elegir", async ({ page }) => {
  await page.goto("/reservar");
  await porNombre(page, /^Para otra persona/).waitFor({ timeout: 60_000 });
  await medir(page, "paso 1 inicial");
});

test("kiosco · niveles y materias", async ({ page }) => {
  await alPaso1(page);
  await medir(page, "niveles");
  await porNombre(page, /^Secundaria\. 1° a 6° año/).click();
  await medir(page, "materias de secundaria");
  await porNombre(page, /^Materia: Matemática$/).click();
  await medir(page, "materia elegida");
});

test("kiosco · búsqueda abierta", async ({ page }) => {
  await alPaso1(page);
  await porNombre(page, /^Universitario/).click();
  await page.getByPlaceholder("Buscar materia…").fill("quím");
  await expect(page.getByRole("listbox", { name: "Materias encontradas" })).toBeVisible();
  await medir(page, "búsqueda con resultados");
  await page.getByPlaceholder("Buscar materia…").fill("zzzz");
  await medir(page, "búsqueda sin resultados");
});

test("kiosco · CBC y materia escrita a mano (la captura de Agustín)", async ({ page }) => {
  await alPaso1(page);
  await porNombre(page, /^Universitario/).click();
  const chip = page.locator(".bmat-chip").first();
  if (await chip.count()) {
    await chip.click();
    await medir(page, "chip del CBC elegido");
  }
  await porNombre(page, /No está en la lista/).click();
  await page.getByPlaceholder(/Por ejemplo/).fill("Estadística Aplicada");
  await medir(page, "materia escrita, sin confirmar");
  await porNombre(page, /^Usar esta/).click();
  await expect(page.locator(".bmat-elegida")).toBeVisible();
  await medir(page, "materia escrita y confirmada");
});

test("kiosco · modalidad", async ({ page }) => {
  await alPaso1(page);
  await porNombre(page, /^Secundaria\. 1° a 6° año/).click();
  await porNombre(page, /^Materia: Matemática$/).click();
  await continuar(page);
  await expect(porNombre(page, /^Online/)).toBeVisible();
  await medir(page, "modalidad sin elegir");
  await porNombre(page, /^Online/).click();
  await medir(page, "modalidad elegida");
});

test("kiosco · turno, datos y confirmación", async ({ page }) => {
  test.skip(!(await hayBackend()), "necesita el backend en :4100 para la disponibilidad real");
  await alPaso1(page);
  await porNombre(page, /^Secundaria\. 1° a 6° año/).click();
  await porNombre(page, /^Materia: Matemática$/).click();
  await continuar(page);
  await porNombre(page, /^Online/).click();
  await continuar(page);
  await expect(page.locator(".react-datepicker__day--selected")).toBeVisible({ timeout: 30_000 });
  await medir(page, "calendario");
  const horario = page.locator("button.ksc-slot:not([disabled])").first();
  await horario.click();
  await medir(page, "horario elegido");
  await continuar(page);
  await medir(page, "datos vacíos");
  await continuar(page);
  await medir(page, "datos con errores");
});

test("portal · acceso y errores", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByLabel(/código de reserva/i)).toBeVisible({ timeout: 30_000 });
  await medir(page, "acceso al portal");
  /* "Entrar" queda deshabilitado con los campos vacíos: los errores aparecen al
     salir de un campo con un valor inválido. */
  await page.getByLabel(/código de reserva/i).fill("X");
  await page.getByLabel(/email o teléfono/i).focus();
  await medir(page, "acceso con errores");
});

test("portal · turno cargado y modales", async ({ page }) => {
  await instalarPortal(page);
  await page.goto("/portal");
  await page.getByLabel(/código de reserva/i).fill(TURNO.bookingCode);
  await page.getByLabel(/email o teléfono/i).fill(TURNO.email);
  await page.getByRole("button", { name: /entrar de forma segura/i }).click();
  await expect(page.getByRole("button", { name: /^Cancelar$/ })).toBeVisible({ timeout: 30_000 });
  await medir(page, "portal con turno");
  await page.getByRole("button", { name: /^Cancelar$/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600);
  await medir(page, "modal de cancelar");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Cambiar horario$/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600);
  await medir(page, "modal de reprogramar");
});

test("página que no existe", async ({ page }) => {
  await page.goto("/esto-no-existe");
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  await medir(page, "404");
});

test("acceso del profesor", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByLabel(/usuario/i)).toBeVisible({ timeout: 30_000 });
  await medir(page, "login del panel");
});

/* EL PANEL DEL PROFESOR, SIN CONTRASEÑA.
 *
 * El panel toma su sesión de `sessionStorage.adminToken`. Acá se planta un
 * token de mentira y se responde a sus pedidos desde el navegador: nadie
 * escribe una contraseña ni se firma un token con el secreto del servidor, que
 * podría ser el de producción. Los datos son mínimos a propósito: una lista
 * vacía igual pinta tarjetas, encabezados, barras y estados vacíos, que es lo
 * que se mide en oscuro. */
const instalarPanel = async (page) => {
  await page.addInitScript(() => sessionStorage.setItem("adminToken", "token-de-prueba"));
  await page.route(/\/api\/(bookings|students|notifications|blocked-dates|settings\/admin)/, (r) => {
    const url = r.request().url();
    if (/settings\/admin/.test(url)) return json(r, { success: true, data: {} });
    if (/bookings(\?|$)/.test(url) && r.request().method() === "GET") return json(r, { success: true, data: [TURNO] });
    return json(r, { success: true, data: [] });
  });
};

const VISTAS_DEL_PANEL = [
  "Resumen",
  "Agenda",
  "Alumnos",
  "Turnos",
  "Historial",
  "Notificaciones",
  "Disponibilidad",
  "Ajustes",
];

test("panel del profesor, vista por vista", async ({ page }) => {
  await instalarPanel(page);
  await page.goto("/admin");
  /* En escritorio el panel navega con la barra lateral; en el teléfono, con la
     barra de abajo (que muestra cuatro vistas y el resto en «Más»). */
  await expect(page.locator(".admin-nav-btn:visible, .bottom-nav-btn:visible").first()).toBeVisible({ timeout: 30_000 });
  for (const vista of VISTAS_DEL_PANEL) {
    const boton = page.locator(".admin-nav-btn:visible, .bottom-nav-btn:visible").filter({ hasText: vista }).first();
    if (!(await boton.count())) continue;
    await boton.click();
    await page.waitForTimeout(600);
    await medir(page, `panel: ${vista}`);
  }
});

test("menú del teléfono abierto", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.locator("#nav-menu-sheet")).toBeVisible();
  await medir(page, "menú del teléfono");
});

test("panel de accesibilidad abierto", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Abrir panel de accesibilidad/ }).click();
  await page.waitForTimeout(600);
  await medir(page, "panel de accesibilidad");
});
