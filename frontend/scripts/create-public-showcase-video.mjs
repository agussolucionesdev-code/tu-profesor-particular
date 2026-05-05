import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(frontendRoot, "..");
const backendRoot = path.join(workspaceRoot, "backend");
const outputDir = path.join(workspaceRoot, "artifacts", "demo-video");
const tempVideoDir = path.join(outputDir, "showcase-temp");
const toolsDir = path.join(outputDir, ".video-tools");

const showcaseWebm = path.join(outputDir, "gestion-turnos-showcase-publico.webm");
const showcaseMp4 = path.join(outputDir, "gestion-turnos-showcase-publico.mp4");
const narrationMp3 = path.join(outputDir, "narracion-showcase-es-ar.mp3");
const musicWav = path.join(outputDir, "musica-showcase-calida.wav");
const narrationMarkdown = path.join(outputDir, "guion-showcase-publicitario.md");
const metadataTxt = path.join(outputDir, "gestion-turnos-showcase-publico.metadata.txt");

const backendPort = 4321;
const frontendPort = 5181;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const viteBin = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const demoEmail = "familia.demo@example.com";
const demoPhone = "+54 9 11-2222-3333";

const narrationText = [
  "Cuando una familia busca apoyo escolar, no necesita otra complicacion. Necesita claridad, calma y una forma simple de pedir ayuda.",
  "Por eso, Tu Profesor Particular suma una experiencia de turnos pensada para acompanar el proceso desde el primer clic.",
  "La reserva se completa paso a paso: datos del alumno, contacto del responsable, materia, nivel y situacion academica. Todo queda ordenado antes de la clase.",
  "Despues, el calendario muestra fechas reales y los horarios disponibles. Sin ida y vuelta innecesaria, sin perder informacion y sin depender de mensajes sueltos.",
  "Al confirmar, la familia recibe un codigo de gestion y tambien un comprobante por mail. Esa doble referencia da seguridad y permite volver al turno cuando haga falta.",
  "Desde Mis Turnos se puede consultar la reserva, revisar los datos, reprogramar con calma o iniciar una cancelacion protegida para evitar errores.",
  "La interfaz tambien se adapta: modo claro, modo oscuro, controles de accesibilidad, texto mas legible y una experiencia pensada para reducir carga mental.",
  "No estas viendo solo una aplicacion. Estas viendo una manera mas amable de organizar clases particulares, cuidar el tiempo de la familia y llegar a cada encuentro con mas contexto y confianza.",
].join(" ");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${command} ${args.join(" ")} failed with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

const waitForUrl = async (url, timeoutMs = 60000) => {
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
      // Server is still booting.
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
      // Fall back to normal termination.
    }
  }

  child.kill("SIGTERM");
};

async function ensureVideoTools() {
  const packageJson = path.join(toolsDir, "package.json");
  const ffmpegPackage = path.join(toolsDir, "node_modules", "@ffmpeg-installer", "ffmpeg");
  const edgeTtsPackage = path.join(toolsDir, "node_modules", "node-edge-tts");

  if (existsSync(packageJson) && existsSync(ffmpegPackage) && existsSync(edgeTtsPackage)) {
    return;
  }

  await fs.mkdir(toolsDir, { recursive: true });
  await run(process.execPath, [
    npmCli,
    "install",
    "--prefix",
    toolsDir,
    "--no-audit",
    "--no-fund",
    "@ffmpeg-installer/ffmpeg",
    "node-edge-tts",
  ]);
}

function getToolsRequire() {
  return createRequire(path.join(toolsDir, "package.json"));
}

function getFfmpegPath() {
  return getToolsRequire()("@ffmpeg-installer/ffmpeg").path;
}

async function synthesizeNarration() {
  await fs.writeFile(
    narrationMarkdown,
    `# Guion showcase publicitario\n\n${narrationText}\n\nVoz: es-AR-ElenaNeural, velocidad levemente mas serena.\n`,
    "utf8",
  );

  const edgeTtsCli = path.join(toolsDir, "node_modules", "node-edge-tts", "bin.js");
  await run(process.execPath, [
    edgeTtsCli,
    "-t",
    narrationText,
    "-f",
    narrationMp3,
    "-v",
    "es-AR-ElenaNeural",
    "-l",
    "es-AR",
    "-r",
    "-5%",
    "--pitch",
    "-2%",
    "--volume",
    "+18%",
    "--timeout",
    "45000",
  ]);
}

async function createWarmMusicBed(file, seconds = 150) {
  const sampleRate = 44_100;
  const channels = 2;
  const totalFrames = sampleRate * seconds;
  const bytesPerSample = 2;
  const dataSize = totalFrames * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const chords = [
    [196.0, 246.94, 293.66, 392.0, 493.88],
    [174.61, 220.0, 261.63, 349.23, 440.0],
    [164.81, 207.65, 246.94, 329.63, 415.3],
    [146.83, 196.0, 246.94, 293.66, 392.0],
  ];

  let offset = 44;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = frame / sampleRate;
    const chord = chords[Math.floor(t / 10) % chords.length];
    const fadeIn = Math.min(1, t / 5);
    const fadeOut = Math.min(1, (seconds - t) / 6);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const breath = 0.86 + Math.sin(2 * Math.PI * 0.045 * t) * 0.14;
    const pad = chord.reduce((sum, frequency, index) => {
      const detune = 1 + Math.sin(t * 0.07 + index) * 0.0018;
      const wave = Math.sin(2 * Math.PI * frequency * detune * t + index * 0.37);
      const softHarmonic = Math.sin(2 * Math.PI * frequency * 2 * t + index) * 0.18;
      return sum + (wave + softHarmonic) * (0.15 / chord.length);
    }, 0);
    const pulseEnvelope = Math.max(0, 1 - ((t % 5) / 2.3));
    const bell = Math.sin(2 * Math.PI * 783.99 * t) * pulseEnvelope * 0.012;
    const sample = Math.max(-1, Math.min(1, (pad * breath + bell) * envelope));
    const left = Math.round(sample * 32767);
    const right = Math.round(sample * 0.94 * 32767);

    buffer.writeInt16LE(left, offset);
    buffer.writeInt16LE(right, offset + 2);
    offset += 4;
  }

  await fs.writeFile(file, buffer);
}

async function installShowcaseStyles(page) {
  await page.addStyleTag({
    content: `
      .nav-item:has(.nav-link-btn[href="/admin"]),
      .nav-link-btn[href="/admin"],
      a[href="/admin"] {
        display: none !important;
      }

      [data-showcase-card],
      [data-showcase-email],
      [data-showcase-focus] {
        font-family: "Aptos Display", "Trebuchet MS", "Segoe UI", sans-serif !important;
      }

      [data-showcase-card] {
        --accent: #4fb477;
        position: fixed;
        z-index: 2147483646;
        max-width: min(680px, calc(100vw - 72px));
        padding: 30px 34px;
        border-radius: 34px;
        color: #f8fbff;
        background:
          radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent) 54%, transparent), transparent 42%),
          linear-gradient(135deg, rgba(13, 26, 42, 0.96), rgba(22, 45, 70, 0.93));
        border: 1px solid rgba(255, 255, 255, 0.28);
        box-shadow: 0 34px 90px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.18);
        backdrop-filter: blur(22px) saturate(1.15);
        animation: showcaseCardIn 520ms cubic-bezier(.18,.95,.25,1) both;
      }

      [data-showcase-card].center {
        inset: 50% auto auto 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }

      [data-showcase-card].bottom-left {
        left: 34px;
        bottom: 34px;
      }

      [data-showcase-card].bottom-right {
        right: 34px;
        bottom: 34px;
      }

      [data-showcase-card].top-right {
        right: 34px;
        top: 96px;
      }

      [data-showcase-card] .showcase-kicker {
        display: inline-flex;
        width: fit-content;
        margin-bottom: 14px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.15);
        color: #dcffe7;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      [data-showcase-card].center .showcase-kicker {
        margin-inline: auto;
      }

      [data-showcase-card] h2 {
        margin: 0;
        max-width: 12.5em;
        font-size: clamp(38px, 5.4vw, 72px);
        line-height: 0.92;
        letter-spacing: -0.065em;
        text-wrap: balance;
      }

      [data-showcase-card].center h2 {
        margin-inline: auto;
      }

      [data-showcase-card] p {
        margin: 18px 0 0;
        max-width: 34em;
        color: rgba(248, 251, 255, 0.9);
        font-size: clamp(20px, 2.1vw, 28px);
        line-height: 1.32;
        font-weight: 650;
        text-wrap: pretty;
      }

      [data-showcase-card] .showcase-micro {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }

      [data-showcase-card].center .showcase-micro {
        justify-content: center;
      }

      [data-showcase-card] .showcase-micro span {
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        color: rgba(255,255,255,0.92);
        font-size: 15px;
        font-weight: 800;
      }

      [data-showcase-focus] {
        position: fixed;
        z-index: 2147483645;
        pointer-events: none;
        border: 4px solid rgba(82, 184, 121, 0.95);
        border-radius: 26px;
        box-shadow: 0 0 0 9999px rgba(5, 12, 23, 0.18), 0 0 46px rgba(82, 184, 121, 0.65);
        animation: showcasePulse 1200ms ease-in-out infinite alternate;
      }
    `,
  });

  await page.addStyleTag({
    content: `
      [data-showcase-email] {
        position: fixed;
        z-index: 2147483647;
        right: 38px;
        top: 104px;
        width: min(520px, calc(100vw - 76px));
        padding: 0;
        border-radius: 30px;
        color: #162132;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(78, 105, 134, 0.22);
        box-shadow: 0 34px 100px rgba(12, 27, 44, 0.34);
        overflow: hidden;
        animation: showcaseEmailIn 640ms cubic-bezier(.18,.95,.25,1) both;
      }

      [data-theme="dark"] [data-showcase-email] {
        color: #edf6ff;
        background: rgba(11, 23, 39, 0.96);
        border-color: rgba(255,255,255,0.22);
      }

      .showcase-email-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        background: linear-gradient(135deg, #e9f7ee, #dcecff);
      }

      [data-theme="dark"] .showcase-email-head {
        background: linear-gradient(135deg, #143225, #183656);
      }

      .showcase-email-head strong {
        display: block;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .showcase-email-head span {
        font-size: 13px;
        font-weight: 800;
        color: #4b6a86;
      }

      [data-theme="dark"] .showcase-email-head span {
        color: #bdd7ef;
      }

      .showcase-email-dot {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 999px;
        background: #2e9155;
        color: white;
        font-size: 13px;
        font-weight: 950;
      }

      .showcase-email-body {
        padding: 24px;
      }

      .showcase-email-subject {
        margin: 0 0 14px;
        color: #102034;
        font-size: 27px;
        line-height: 1.08;
        letter-spacing: -0.04em;
      }

      [data-theme="dark"] .showcase-email-subject {
        color: #f8fbff;
      }

      .showcase-email-body p {
        margin: 0 0 16px;
        color: #50667b;
        font-size: 17px;
        line-height: 1.5;
        font-weight: 650;
      }

      [data-theme="dark"] .showcase-email-body p {
        color: #d3e1ef;
      }

      .showcase-email-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .showcase-email-grid article {
        padding: 14px;
        border-radius: 18px;
        background: #f2f7fb;
        border: 1px solid #e0ebf4;
      }

      [data-theme="dark"] .showcase-email-grid article {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.13);
      }

      .showcase-email-grid span {
        display: block;
        color: #6c7d8c;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .showcase-email-grid strong {
        display: block;
        margin-top: 5px;
        font-size: 17px;
        line-height: 1.2;
      }

      @keyframes showcaseCardIn {
        from { opacity: 0; transform: translateY(18px) scale(0.975); filter: blur(8px); }
        to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      }

      [data-showcase-card].center {
        animation-name: showcaseCenterIn;
      }

      @keyframes showcaseCenterIn {
        from { opacity: 0; transform: translate(-50%, -46%) scale(0.965); filter: blur(8px); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
      }

      @keyframes showcaseEmailIn {
        from { opacity: 0; transform: translateY(24px) translateX(20px) scale(0.96); filter: blur(8px); }
        to { opacity: 1; transform: translateY(0) translateX(0) scale(1); filter: blur(0); }
      }

      @keyframes showcasePulse {
        from { opacity: 0.68; }
        to { opacity: 1; }
      }
    `,
  });
}

async function showCard(page, payload) {
  await page.evaluate(({ kicker, title, body, chips = [], position = "bottom-left", accent = "#4fb477" }) => {
    document.querySelector("[data-showcase-card]")?.remove();

    const card = document.createElement("aside");
    card.dataset.showcaseCard = "true";
    card.className = position;
    card.style.setProperty("--accent", accent);

    const kickerNode = document.createElement("span");
    kickerNode.className = "showcase-kicker";
    kickerNode.textContent = kicker;

    const titleNode = document.createElement("h2");
    titleNode.textContent = title;

    const bodyNode = document.createElement("p");
    bodyNode.textContent = body;

    card.append(kickerNode, titleNode, bodyNode);

    if (chips.length > 0) {
      const chipRow = document.createElement("div");
      chipRow.className = "showcase-micro";
      for (const chip of chips) {
        const chipNode = document.createElement("span");
        chipNode.textContent = chip;
        chipRow.append(chipNode);
      }
      card.append(chipRow);
    }

    document.body.append(card);
  }, payload);
}

async function clearCard(page) {
  await page.evaluate(() => {
    document.querySelector("[data-showcase-card]")?.remove();
  });
}

async function showFocus(page, selector) {
  await page.evaluate((focusSelector) => {
    document.querySelector("[data-showcase-focus]")?.remove();
    const target = document.querySelector(focusSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const focus = document.createElement("div");
    focus.dataset.showcaseFocus = "true";
    focus.style.left = `${Math.max(16, rect.left - 10)}px`;
    focus.style.top = `${Math.max(16, rect.top - 10)}px`;
    focus.style.width = `${Math.max(80, rect.width + 20)}px`;
    focus.style.height = `${Math.max(60, rect.height + 20)}px`;
    document.body.append(focus);
  }, selector);
}

async function clearFocus(page) {
  await page.evaluate(() => {
    document.querySelector("[data-showcase-focus]")?.remove();
  });
}

async function showEmailPreview(page, { bookingCode }) {
  await page.evaluate(({ bookingCode: code, email }) => {
    document.querySelector("[data-showcase-email]")?.remove();

    const panel = document.createElement("aside");
    panel.dataset.showcaseEmail = "true";

    const head = document.createElement("div");
    head.className = "showcase-email-head";
    const headCopy = document.createElement("div");
    const headTitle = document.createElement("strong");
    headTitle.textContent = "Nuevo correo";
    const headRecipient = document.createElement("span");
    headRecipient.textContent = email;
    headCopy.append(headTitle, headRecipient);
    const badge = document.createElement("span");
    badge.className = "showcase-email-dot";
    badge.textContent = "Recibido";
    head.append(headCopy, badge);

    const body = document.createElement("div");
    body.className = "showcase-email-body";
    const subject = document.createElement("h3");
    subject.className = "showcase-email-subject";
    subject.textContent = "Reserva confirmada para tu clase particular";
    const copy = document.createElement("p");
    copy.textContent = "El comprobante llega al mail con fecha, horario, alumno, materia y codigo de gestion para volver a Mis Turnos.";
    const grid = document.createElement("div");
    grid.className = "showcase-email-grid";

    const items = [
      ["Codigo", code],
      ["Materia", "Matematica"],
      ["Alumno", "Lucia Fernandez"],
      ["Gestion", "Mis Turnos"],
    ];

    for (const [label, value] of items) {
      const item = document.createElement("article");
      const itemLabel = document.createElement("span");
      itemLabel.textContent = label;
      const itemValue = document.createElement("strong");
      itemValue.textContent = value;
      item.append(itemLabel, itemValue);
      grid.append(item);
    }

    body.append(subject, copy, grid);
    panel.append(head, body);
    document.body.append(panel);
  }, { bookingCode, email: demoEmail });
}

async function clearEmailPreview(page) {
  await page.evaluate(() => {
    document.querySelector("[data-showcase-email]")?.remove();
  });
}

async function patchNotificationResponses(page) {
  const patch = async (route, eventName) => {
    const response = await route.fetch();
    const body = await response.json();

    if (body?.success) {
      body.notifications = {
        client: { sent: true, recipient: demoEmail },
        owner: { sent: false, recipient: "" },
        demo: true,
        event: eventName,
      };
    }

    const headers = response.headers();
    headers["content-type"] = "application/json; charset=utf-8";

    await route.fulfill({
      status: response.status(),
      headers,
      body: JSON.stringify(body),
    });
  };

  await page.route(`${backendUrl}/api/bookings/reserve`, (route) => patch(route, "created"));
  await page.route(`${backendUrl}/api/bookings/reschedule`, (route) => patch(route, "rescheduled"));
  await page.route(`${backendUrl}/api/bookings/cancel`, (route) => patch(route, "cancelled"));
}

async function fillBookingForm(page) {
  await page.locator('input[name="studentName"]').fill("Lucia Fernandez");
  await page.locator('input[name="phone"]').fill(demoPhone);
  await page.locator('input[name="responsibleName"]').fill("Mariana Fernandez");
  await page.locator('select[name="responsibleRelationship"]').selectOption("madre");
  await page.locator('input[name="email"]').fill(demoEmail);
  await page.locator('select[name="educationLevel"]').selectOption("Secundaria");
  await page.locator('select[name="yearGrade"]').selectOption("3er ano");
  await page.locator('input[name="subject"]').fill("Matematica");
  await page.locator('input[name="school"]').fill("Escuela Normal");
  await page
    .locator('textarea[name="academicSituation"]')
    .fill("Necesita reforzar ecuaciones y llegar con mas seguridad al examen.");
}

async function openAndShowAccessibility(page) {
  await showCard(page, {
    kicker: "Experiencia flexible",
    title: "La app se adapta a cada familia.",
    body: "Modo claro, modo oscuro y ajustes de lectura ayudan a bajar la friccion antes de reservar.",
    chips: ["Tema visual", "Texto legible", "Menos carga mental"],
    position: "bottom-right",
    accent: "#64a8ff",
  });
  await page.getByRole("button", { name: /Cambiar a modo oscuro/i }).click();
  await sleep(1500);
  await page.getByRole("button", { name: /Cambiar a modo claro/i }).click();
  await sleep(900);
  await page.getByRole("button", { name: /Abrir panel de accesibilidad/i }).click();
  await sleep(1200);
  await showFocus(page, ".a11y-panel");
  await sleep(1800);
  const accessibilityPanel = page.locator(".a11y-panel");
  await accessibilityPanel.getByRole("button", { name: "Oscuro", exact: true }).click();
  await sleep(900);
  await accessibilityPanel.getByRole("button", { name: "Claro", exact: true }).click();
  await sleep(700);
  await accessibilityPanel.getByRole("button", { name: "Grande", exact: true }).click();
  await sleep(900);
  await accessibilityPanel.getByRole("button", { name: /Restablecer/i }).click();
  await sleep(700);
  await page.getByRole("button", { name: /Cerrar panel de accesibilidad/i }).click();
  await clearFocus(page);
  await sleep(800);
}

async function recordShowcase() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(tempVideoDir, { recursive: true, force: true });
  await fs.rm(showcaseWebm, { force: true });
  await fs.rm(showcaseMp4, { force: true });
  await fs.rm(metadataTxt, { force: true });
  await fs.mkdir(tempVideoDir, { recursive: true });

  console.log("Starting showcase backend...");
  const backend = spawn("node", ["server.js"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(backendPort),
      USE_MEMORY_DB: "true",
      MONGO_URI: "",
      MONGO_FALLBACK_TO_MEMORY: "false",
      JWT_SECRET: "showcase-video-secret-change-before-production",
      ADMIN_USERNAME: "admin.demo@example.com",
      ADMIN_PASSWORD: "DemoPass1234!",
      CORS_ORIGIN: frontendUrl,
      FRONTEND_URL: frontendUrl,
      RATE_LIMIT_MAX: "1000",
      AUTH_RATE_LIMIT_MAX: "1000",
      PUBLIC_LOOKUP_RATE_LIMIT_MAX: "1000",
      PUBLIC_MUTATION_RATE_LIMIT_MAX: "1000",
      EMAIL_USER: "",
      EMAIL_PASS: "",
      OWNER_NOTIFICATION_EMAIL: "",
      GOOGLE_SHEET_ID: "",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeProcessLogs(backend, "backend");

  console.log("Starting showcase frontend...");
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
    await waitForUrl(`${backendUrl}/health`);
    await waitForUrl(frontendUrl);

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: tempVideoDir,
        size: { width: 1920, height: 1080 },
      },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    await page.addInitScript(() => {
      const hideAdminStyle = document.createElement("style");
      hideAdminStyle.dataset.showcaseAdminHide = "true";
      hideAdminStyle.textContent = `
        .nav-item:has(.nav-link-btn[href="/admin"]),
        .nav-link-btn[href="/admin"],
        a[href="/admin"] {
          display: none !important;
        }
      `;
      document.documentElement.append(hideAdminStyle);
      window.localStorage.setItem("muted_alerts", "true");
      window.localStorage.setItem("voice_hint_seen", "true");
      window.localStorage.setItem("theme", "light");
      window.localStorage.setItem(
        "ui_accessibility_preferences",
        JSON.stringify({
          themePreference: "light",
          fontScale: "default",
          contrast: "default",
          fontFamily: "brand",
          motion: "default",
          accentBalance: "balanced",
          calmUi: false,
        }),
      );
    });
    await patchNotificationResponses(page);

    console.log("Opening public booking experience...");
    await page.goto(`${frontendUrl}/reservar`, { waitUntil: "networkidle" });
    await installShowcaseStyles(page);
    await page.waitForSelector(".form-card-elevation");

    await showCard(page, {
      kicker: "Tu Profesor Particular",
      title: "Reservar una clase puede sentirse simple.",
      body: "Una experiencia pensada para familias que necesitan apoyo, claridad y una respuesta rapida.",
      chips: ["Sin vueltas", "Con codigo de gestion", "Acompanamiento humano"],
      position: "center",
      accent: "#54b57a",
    });
    await sleep(4300);

    await openAndShowAccessibility(page);

    await showCard(page, {
      kicker: "Paso 1",
      title: "Datos claros antes de la clase.",
      body: "El formulario ordena contacto, responsable, nivel, materia y contexto academico para llegar mejor preparados.",
      chips: ["Validacion al momento", "Menos mensajes sueltos", "Mas contexto"],
      position: "bottom-left",
      accent: "#4fb477",
    });
    await clearEmailPreview(page);
    await fillBookingForm(page);
    await showFocus(page, ".journey-compass");
    await sleep(2200);
    await clearFocus(page);

    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.waitForSelector(".neuro-calendar-rich");
    await showCard(page, {
      kicker: "Paso 2",
      title: "Elegir dia sin adivinar.",
      body: "La familia ve el calendario y avanza solo cuando encontro una fecha comoda.",
      chips: ["Fechas reales", "Decision tranquila"],
      position: "top-right",
      accent: "#58a7d8",
    });
    await showFocus(page, ".neuro-calendar-rich");
    await sleep(1800);

    const availableDays = page.locator(
      ".react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--outside-month)",
    );
    await availableDays.nth(5).click();
    await sleep(900);
    console.log("Moving to time slot step...");
    await page.locator(".active-panel button.desktop-stage-cta.is-ready").click({ force: true });
    await page.waitForSelector(".slot-btn:not(.disabled)");
    await clearFocus(page);

    await showCard(page, {
      kicker: "Paso 3",
      title: "Solo horarios libres.",
      body: "La app reduce la carga mental: muestra bloques disponibles y evita cruces de agenda.",
      chips: ["Manana", "Tarde", "Tarde noche"],
      position: "bottom-right",
      accent: "#e7a64f",
    });
    await showFocus(page, ".slot-sections-grid");
    await sleep(1400);
    console.log("Selecting first available time slot...");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".slot-btn:not(.disabled)")).some((button) => {
        const rect = button.getBoundingClientRect();
        const styles = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
      }),
    );
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll(".slot-btn:not(.disabled)")).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const styles = window.getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
      });
      button?.click();
    });
    await sleep(1000);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button.desktop-stage-cta.is-ready")).some((button) => {
        const rect = button.getBoundingClientRect();
        const styles = window.getComputedStyle(button);
        return (
          button.textContent?.includes("Continuar") &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      }),
    );
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button.desktop-stage-cta.is-ready")).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const styles = window.getComputedStyle(candidate);
        return (
          candidate.textContent?.includes("Continuar") &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      });
      button?.click();
    });
    await page.waitForSelector(".duration-option-grid");
    await clearFocus(page);

    await showCard(page, {
      kicker: "Paso 4",
      title: "Confirmar con seguridad.",
      body: "Antes de guardar, el resumen muestra dia, horario, duracion, alumno y materia.",
      chips: ["Resumen final", "Codigo", "Comprobante"],
      position: "bottom-left",
      accent: "#d98a55",
    });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some((button) => {
        const rect = button.getBoundingClientRect();
        const styles = window.getComputedStyle(button);
        return (
          button.textContent?.trim() === "1 h" &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      }),
    );
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const styles = window.getComputedStyle(candidate);
        return (
          candidate.textContent?.trim() === "1 h" &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      });
      button?.click();
    });
    await showFocus(page, ".duration-option-grid");
    await sleep(1600);
    await clearFocus(page);

    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some((button) => {
        const rect = button.getBoundingClientRect();
        const styles = window.getComputedStyle(button);
        return (
          /Confirmar Reserva/i.test(button.textContent || "") &&
          !button.disabled &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      }),
    );
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const styles = window.getComputedStyle(candidate);
        return (
          /Confirmar Reserva/i.test(candidate.textContent || "") &&
          !candidate.disabled &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.visibility !== "hidden" &&
          styles.display !== "none"
        );
      });
      button?.click();
    });
    await page.waitForSelector(".success-code-panel h3", { timeout: 25000 });
    const bookingCode = (await page.locator(".success-code-panel h3").innerText()).trim();
    console.log(`Created showcase booking ${bookingCode}`);

    await showCard(page, {
      kicker: "Turno confirmado",
      title: "Codigo y mail: doble tranquilidad.",
      body: "La familia puede guardar el codigo y recibe el comprobante en el correo cargado.",
      chips: [bookingCode, demoEmail],
      position: "bottom-left",
      accent: "#4fb477",
    });
    await showEmailPreview(page, { bookingCode });
    await sleep(4300);
    await clearEmailPreview(page);

    await page.getByRole("link", { name: /Ir a Mis Turnos/i }).click();
    await page.waitForURL(/\/portal/);
    await showCard(page, {
      kicker: "Mis Turnos",
      title: "Volver al turno cuando haga falta.",
      body: "Se puede buscar por codigo, email o telefono. Asi nadie depende de recordar un solo dato.",
      chips: ["Codigo", "Email", "Telefono"],
      position: "center",
      accent: "#5fa9da",
    });
    await sleep(2400);
    await clearCard(page);

    await showFocus(page, ".portal-guidance");
    await sleep(1000);
    await clearFocus(page);
    await page.getByPlaceholder(/codigo|email|telefono|tel.cfono/i).fill(bookingCode);
    await sleep(700);
    await page.getByRole("button", { name: /Buscar mis turnos/i }).click();
    await page.waitForSelector(".ticket-card", { timeout: 15000 });
    await showCard(page, {
      kicker: "Consulta simple",
      title: "La ficha queda lista para gestionar.",
      body: "Aparecen alumno, contacto, materia, fecha, horario y acciones importantes en un solo lugar.",
      chips: ["Revisar", "Reprogramar", "Cancelar"],
      position: "bottom-right",
      accent: "#74b983",
    });
    await showFocus(page, ".ticket-card");
    await sleep(3000);
    await clearFocus(page);

    await page.getByRole("button", { name: /Reprogramar turno/i }).click();
    await page.waitForSelector(".reschedule-modal-box", { timeout: 15000 });
    await showCard(page, {
      kicker: "Reprogramacion",
      title: "Cambiar sin perder claridad.",
      body: "La pantalla compara el turno actual con la nueva propuesta antes de confirmar cualquier cambio.",
      chips: ["Compara", "Elegis", "Confirmas"],
      position: "bottom-left",
      accent: "#b58bdc",
    });
    await showFocus(page, ".reschedule-modal-box");
    await sleep(4300);
    await page.getByRole("button", { name: /Mantener actual/i }).click();
    await clearFocus(page);
    await sleep(900);

    await page.getByRole("button", { name: /Cancelar turno/i }).click();
    await page.waitForSelector(".cancel-soft-modal", { timeout: 15000 });
    await showCard(page, {
      kicker: "Cancelacion protegida",
      title: "Nada se cancela por accidente.",
      body: "El sistema pide una confirmacion clara y explica que el horario vuelve a quedar disponible.",
      chips: ["Decision consciente", "Horario liberado", "Sin ruido visual"],
      position: "bottom-right",
      accent: "#d96d61",
    });
    await showFocus(page, ".cancel-soft-modal");
    await sleep(3600);
    await page.getByRole("button", { name: /No, mantenerlo/i }).click();
    await clearFocus(page);
    await sleep(900);

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    await showCard(page, {
      kicker: "Acompanamiento",
      title: "La tecnologia no reemplaza el vinculo.",
      body: "Ordena el proceso para que el profesor pueda concentrarse en lo importante: ensenar y acompanar.",
      chips: ["WhatsApp", "Portal", "Mail"],
      position: "bottom-left",
      accent: "#56b884",
    });
    await sleep(3600);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1200);
    await page.getByRole("button", { name: /Cambiar a modo oscuro/i }).click();
    await showCard(page, {
      kicker: "Cierre",
      title: "Mas orden. Mas confianza. Menos friccion.",
      body: "Una app creada para agilizar la gestion de turnos de Tu Profesor Particular y hacer mas facil pedir ayuda a tiempo.",
      chips: ["Reservar", "Recibir mail", "Gestionar"],
      position: "center",
      accent: "#6fcf97",
    });
    await sleep(5200);

    const video = page.video();
    await context.close();
    await browser.close();
    browser = undefined;
    context = undefined;

    const recordedPath = await video.path();
    await fs.copyFile(recordedPath, showcaseWebm);
    return { showcaseWebm };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    stopProcess(frontend);
    stopProcess(backend);
  }
}

async function convertToMp4() {
  const ffmpegPath = getFfmpegPath();
  const audioFilter =
    "[1:a]aformat=channel_layouts=stereo,aresample=48000,loudnorm=I=-13:TP=-1.0:LRA=8,volume=1.8,adelay=500|500,apad[narr];" +
    "[2:a]aformat=channel_layouts=stereo,aresample=48000,volume=0.42,afade=t=in:st=0:d=3[music];" +
    "[narr][music]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.9,alimiter=limit=0.96,aformat=channel_layouts=stereo[a]";

  await run(ffmpegPath, [
    "-y",
    "-i",
    showcaseWebm,
    "-i",
    narrationMp3,
    "-stream_loop",
    "-1",
    "-i",
    musicWav,
    "-filter_complex",
    audioFilter,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "224k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "-shortest",
    showcaseMp4,
  ]);

  const metadata = await run(ffmpegPath, [
    "-hide_banner",
    "-i",
    showcaseMp4,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  await fs.writeFile(metadataTxt, metadata.stderr || metadata.stdout, "utf8");
  await run(ffmpegPath, [
    "-v",
    "error",
    "-i",
    showcaseMp4,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-f",
    "null",
    "-",
  ]);
}

async function main() {
  await ensureVideoTools();
  await synthesizeNarration();
  await createWarmMusicBed(musicWav);
  await recordShowcase();
  await convertToMp4();

  const stats = await fs.stat(showcaseMp4);
  console.log(`Showcase MP4 ready: ${showcaseMp4}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Narration: ${narrationMp3}`);
  console.log(`Music: ${musicWav}`);
  console.log(`Metadata: ${metadataTxt}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
