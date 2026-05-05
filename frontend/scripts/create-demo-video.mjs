import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(frontendRoot, "..");
const backendRoot = path.join(workspaceRoot, "backend");
const outputDir = path.join(workspaceRoot, "artifacts", "demo-video");
const tempVideoDir = path.join(outputDir, "playwright-temp");
const finalVideoPath = path.join(outputDir, "gestion-turnos-demo.webm");
const narrationPath = path.join(outputDir, "guion-narracion.md");

const backendPort = 4311;
const frontendPort = 5177;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const viteBin = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUrl = async (url, timeoutMs = 45000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok || response.status < 500) {
        clearTimeout(timeout);
        return;
      }
    } catch {
      // The server is still starting.
    } finally {
      clearTimeout(timeout);
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const pipeProcessLogs = (child, label) => {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
  child.on("error", (error) => {
    process.stderr.write(`[${label}] failed to start: ${error.message}\n`);
  });
  child.on("exit", (code, signal) => {
    process.stdout.write(`[${label}] exited with code=${code} signal=${signal}\n`);
  });
};

const stopProcess = (child) => {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      return;
    } catch {
      // Fall back to the cross-platform kill below.
    }
  }

  child.kill("SIGTERM");
};

const showCaption = async (page, title, body, accent = "green") => {
  await page.evaluate(
    ({ title: nextTitle, body: nextBody, accent: nextAccent }) => {
      const existing = document.querySelector("[data-demo-caption]");
      if (existing) existing.remove();

      const caption = document.createElement("aside");
      caption.dataset.demoCaption = "true";
      caption.innerHTML = `
        <span class="demo-caption-kicker">Demo guiada</span>
        <strong>${nextTitle}</strong>
        <p>${nextBody}</p>
      `;
      caption.style.setProperty("--demo-accent", nextAccent);
      document.body.appendChild(caption);
    },
    { title, body, accent },
  );
};

const installCaptionStyles = async (page) => {
  await page.addStyleTag({
    content: `
      [data-demo-caption] {
        --demo-accent: green;
        position: fixed;
        left: 28px;
        bottom: 28px;
        z-index: 2147483647;
        width: min(460px, calc(100vw - 56px));
        padding: 18px 20px 20px;
        border-radius: 24px;
        color: #f8fafc;
        background:
          linear-gradient(135deg, rgba(10, 20, 32, 0.92), rgba(29, 52, 77, 0.9)),
          radial-gradient(circle at top left, color-mix(in srgb, var(--demo-accent) 45%, transparent), transparent 58%);
        border: 1px solid rgba(255, 255, 255, 0.26);
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(18px);
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        animation: demoCaptionIn 360ms cubic-bezier(.2,.9,.2,1);
      }

      [data-demo-caption]::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
      }

      .demo-caption-kicker {
        display: inline-flex;
        width: fit-content;
        margin-bottom: 10px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        color: #d8f5dc;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      [data-demo-caption] strong {
        display: block;
        margin: 0 0 7px;
        font-size: 25px;
        line-height: 1.05;
        letter-spacing: -0.03em;
      }

      [data-demo-caption] p {
        margin: 0;
        color: rgba(248, 250, 252, 0.88);
        font-size: 15px;
        line-height: 1.45;
      }

      @keyframes demoCaptionIn {
        from { opacity: 0; transform: translateY(18px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
  });
};

const fillBookingForm = async (page) => {
  await page.locator('input[name="studentName"]').fill("Lucia Fernandez");
  await page.locator('input[name="phone"]').fill("+54 9 11-2222-3333");
  await page.locator('input[name="responsibleName"]').fill("Mariana Fernandez");
  await page.locator('select[name="responsibleRelationship"]').selectOption("madre");
  await page.locator('input[name="email"]').fill("familia.demo@example.com");
  await page.locator('select[name="educationLevel"]').selectOption("Secundaria");
  await page.locator('select[name="yearGrade"]').selectOption("3er ano");
  await page.locator('input[name="subject"]').fill("Matematica");
  await page.locator('input[name="school"]').fill("Escuela Normal");
  await page
    .locator('textarea[name="academicSituation"]')
    .fill("Necesita reforzar ecuaciones y llegar con mas seguridad al examen.");
};

const recordDemo = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(tempVideoDir, { recursive: true, force: true });
  await fs.rm(finalVideoPath, { force: true });
  await fs.rm(narrationPath, { force: true });
  await fs.mkdir(tempVideoDir, { recursive: true });

  console.log("Starting demo backend...");
  const backend = spawn("node", ["server.js"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(backendPort),
      USE_MEMORY_DB: "true",
      MONGO_URI: "",
      MONGO_FALLBACK_TO_MEMORY: "false",
      JWT_SECRET: "demo-video-secret-change-before-production",
      ADMIN_USERNAME: "admin.demo@example.com",
      ADMIN_PASSWORD: "DemoPass1234!",
      CORS_ORIGIN: frontendUrl,
      FRONTEND_URL: frontendUrl,
      RATE_LIMIT_MAX: "1000",
      AUTH_RATE_LIMIT_MAX: "1000",
      PUBLIC_LOOKUP_RATE_LIMIT_MAX: "1000",
      PUBLIC_MUTATION_RATE_LIMIT_MAX: "1000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeProcessLogs(backend, "backend");

  console.log("Starting demo frontend...");
  const frontend = spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_BACKEND_URL: backendUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  pipeProcessLogs(frontend, "frontend");

  let browser;
  let context;

  try {
    console.log(`Waiting for backend at ${backendUrl}/health...`);
    await waitForUrl(`${backendUrl}/health`);
    console.log(`Waiting for frontend at ${frontendUrl}...`);
    await waitForUrl(frontendUrl);
    console.log("Launching browser recording...");

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      recordVideo: {
        dir: tempVideoDir,
        size: { width: 1366, height: 768 },
      },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    console.log("Opening booking form...");
    await page.goto(`${frontendUrl}/reservar`, { waitUntil: "networkidle" });
    await installCaptionStyles(page);

    await showCaption(
      page,
      "Reservar una clase, sin vueltas",
      "La aplicacion guia al alumno paso a paso: datos, fecha, horario y confirmacion final.",
      "#589860",
    );
    await sleep(2600);

    console.log("Filling booking form...");
    await showCaption(
      page,
      "Primero, los datos clave",
      "El formulario ordena contacto, responsable y perfil academico para evitar errores antes de agendar.",
      "#6ab17a",
    );
    await fillBookingForm(page);
    await sleep(1800);

    console.log("Selecting date...");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.waitForSelector(".neuro-calendar-rich");
    await showCaption(
      page,
      "Agenda visual",
      "El calendario muestra el proximo paso con claridad y despues filtra los horarios disponibles.",
      "#58a7c9",
    );
    await sleep(1400);

    const availableDays = page.locator(
      ".react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--outside-month)",
    );
    await availableDays.nth(2).click();
    await sleep(900);
    await page.getByRole("button", { name: "Ver horarios disponibles", exact: true }).click();
    await page.waitForSelector(".slot-btn:not(.disabled)");

    console.log("Selecting time and duration...");
    await showCaption(
      page,
      "Solo horarios libres",
      "El alumno no tiene que calcular nada: toca un bloque libre y el sistema prepara el resumen.",
      "#e0a94a",
    );
    await page.getByRole("button", { name: /10:00 Libre/i }).click();
    await sleep(900);
    await page.getByRole("button", { name: "Continuar a confirmar", exact: true }).click();
    await page.waitForSelector(".duration-option-grid");

    await showCaption(
      page,
      "Confirmacion clara",
      "Antes de guardar, se revisa duracion, materia, contacto y datos del turno en una sola pantalla.",
      "#d98a55",
    );
    await page.getByRole("button", { name: /^1 h$/i }).click();
    await sleep(1000);
    console.log("Submitting booking...");
    await page.getByRole("button", { name: /Confirmar Reserva/i }).click();
    await page.waitForSelector(".success-code-panel h3", { timeout: 20000 });

    const bookingCode = (await page.locator(".success-code-panel h3").innerText()).trim();
    console.log(`Created demo booking ${bookingCode}`);
    await showCaption(
      page,
      "Turno confirmado",
      `La reserva queda lista con codigo ${bookingCode}. Desde aca se puede volver a Mis Turnos.`,
      "#73bf7c",
    );
    await sleep(2600);

    console.log("Opening client portal...");
    await page.getByRole("link", { name: /Ir a Mis Turnos/i }).click();
    await page.waitForURL(/\/portal/);
    await showCaption(
      page,
      "Gestion desde Mis Turnos",
      "El alumno recupera su reserva con codigo, email o telefono para revisar, reprogramar o cancelar.",
      "#4f9ec4",
    );
    await page.getByPlaceholder(/codigo|email|telefono|teléfono/i).fill(bookingCode);
    await sleep(700);
    await page.getByRole("button", { name: /Buscar mis turnos/i }).click();
    await page.waitForSelector(".ticket-card", { timeout: 15000 });
    await sleep(1300);

    console.log("Opening reschedule modal...");
    await showCaption(
      page,
      "Reprogramar sin llamar",
      "El portal muestra la ficha del turno y las acciones disponibles para gestionar cambios rapido.",
      "#b58bdc",
    );
    await page.getByRole("button", { name: /Reprogramar turno/i }).click();
    await page.waitForSelector(".reschedule-modal-box", { timeout: 15000 });
    await sleep(2300);
    await page.getByRole("button", { name: /Mantener actual/i }).click();
    await sleep(800);

    console.log("Opening admin panel...");
    await page.goto(`${frontendUrl}/admin`, { waitUntil: "networkidle" });
    await showCaption(
      page,
      "Panel del profesor",
      "El administrador ve agenda, alumnos, estados y seguimiento centralizado en un solo lugar.",
      "#5e8dd6",
    );
    await page.getByPlaceholder(/Correo de acceso/i).fill("admin.demo@example.com");
    await page.getByPlaceholder(/Contraseña/i).fill("DemoPass1234!");
    await sleep(500);
    await page.getByRole("button", { name: /Ingresar/i }).click();
    await page.waitForSelector(".admin-main-shell", { timeout: 15000 });
    await sleep(2500);

    await showCaption(
      page,
      "Simple para alumnos, completo para gestionar",
      "La experiencia queda lista para reservar, consultar turnos y administrar la agenda con datos ordenados.",
      "#589860",
    );
    await sleep(3200);

    const video = page.video();
    await context.close();
    await browser.close();
    browser = undefined;
    context = undefined;

    const recordedPath = await video.path();
    await fs.copyFile(recordedPath, finalVideoPath);

    await fs.writeFile(
      narrationPath,
      `# Guion sugerido para narracion\n\n` +
        `1. Esta es la aplicacion de gestion de turnos de Tu Profesor Particular. La reserva esta pensada para avanzar paso a paso, sin confusion.\n\n` +
        `2. Primero se completan los datos del alumno, el adulto responsable y el perfil academico. Asi el profesor recibe contexto real antes de la clase.\n\n` +
        `3. Luego se elige una fecha en el calendario. La aplicacion prepara los horarios disponibles para que el alumno no tenga que consultar por WhatsApp antes de reservar.\n\n` +
        `4. En el paso de horarios se muestran solo bloques posibles. Se selecciona una hora, se define la duracion y se revisa todo antes de confirmar.\n\n` +
        `5. Al confirmar, aparece el codigo de gestion. Ese codigo permite volver a Mis Turnos para revisar, reprogramar o cancelar la reserva.\n\n` +
        `6. En el panel del profesor, toda la informacion queda centralizada: agenda, alumnos, estados y seguimiento.\n`,
      "utf8",
    );

    return { finalVideoPath, narrationPath };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    stopProcess(frontend);
    stopProcess(backend);
  }
};

recordDemo()
  .then(({ finalVideoPath: videoPath, narrationPath: scriptPath }) => {
    console.log(`Demo video created: ${videoPath}`);
    console.log(`Narration script created: ${scriptPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
