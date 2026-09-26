import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import App from "../../src/App";
import { BookingKiosk } from "../../src/paginas";

/* /reservar SE HIDRATA SOBRE EL HTML DEL PRERENDER.
 *
 * Igual que la portada (HidratarLaPortada.test.jsx): el HTML trae el paso 1
 * del kiosco y React lo adopta. Si el primer dibujo del navegador no coincide,
 * React 19 tira el HTML y dibuja de cero —el parpadeo que el prerender vino a
 * sacar— o deja atributos viejos sin corregir.
 *
 * El caso difícil es el de todos los días: alguien que vuelve (modo oscuro, voz
 * activada) y llega desde el sitio con `?materia=…&nivel=…&utm_source=…`. El
 * kiosco usa esos parámetros para dejar la materia preelegida; el HTML se hizo
 * sin ellos. Tiene que hidratar igual: el paso 1 no los muestra. */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const htmlDelServidor = () =>
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import path from "node:path";
        import { compilar, renderizarRuta } from ${JSON.stringify(pathToFileURL(path.join(RAIZ, "prerender.mjs")).href)};
        const raiz = ${JSON.stringify(RAIZ)};
        const { default: App } = await compilar(path.join(raiz, "src/App.jsx"), (a) => "/" + path.relative(raiz, a).split(path.sep).join("/"));
        process.stdout.write(await renderizarRuta(App, "/reservar"));
      `,
    ],
    { cwd: RAIZ, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

const alguienQueVuelveDesdeElSitio = () => {
  window.history.replaceState({}, "", "/reservar?materia=Matem%C3%A1tica&nivel=Secundaria&utm_source=sitio");
  localStorage.setItem("theme", "dark");
  localStorage.setItem("muted_alerts", "false");
  localStorage.setItem("voice_invite_state_v2", JSON.stringify({ done: true, shown: 3 }));
  document.documentElement.dataset.theme = "dark";
  window.matchMedia = (consulta) => ({
    matches: consulta.includes("dark"),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  /* El servidor contesta: sin esto, fuera de la portada la app pasa a la
     página de mantenimiento (useEstadoDelServidor). */
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
};

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/reservar prerenderizado", () => {
  test("se hidrata sin desajustes y con los mismos nodos, aun con materia y nivel en la URL", async () => {
    const html = htmlDelServidor();
    alguienQueVuelveDesdeElSitio();

    const raiz = document.createElement("div");
    raiz.id = "root";
    raiz.innerHTML = html;
    document.body.append(raiz);
    const tituloDelHtml = raiz.querySelector("h1");
    expect(tituloDelHtml?.textContent).toMatch(/¿Para quién es la clase\?/);

    const problemas = [];
    vi.spyOn(console, "error").mockImplementation((...partes) => {
      const texto = partes.map(String).join(" ");
      if (/hydrat|did(n't| not) match|server rendered/i.test(texto)) problemas.push(texto.slice(0, 400));
    });

    await BookingKiosk.precargar();
    let root;
    await act(async () => {
      root = hydrateRoot(raiz, <App />, {
        onRecoverableError: (error) => problemas.push(`recuperable: ${error.message.slice(0, 400)}`),
      });
    });

    expect(problemas).toEqual([]);
    /* Adoptó el HTML: el título del paso 1 es el MISMO nodo. */
    expect(raiz.querySelector("h1")).toBe(tituloDelHtml);
    /* Y el paso 1 ya responde: el botón tiene su componente de React. */
    const otraPersona = [...raiz.querySelectorAll("button")].find((b) => /Para otra persona/.test(b.textContent));
    expect(Object.keys(otraPersona).some((k) => k.startsWith("__reactFiber"))).toBe(true);
    /* Después de hidratar, el estado real: modo oscuro. */
    for (const boton of raiz.querySelectorAll(".tpp-nav-theme")) {
      expect(boton).toHaveAttribute("aria-label", "Cambiar a modo claro");
    }

    act(() => root.unmount());
    raiz.remove();
  }, 90_000);
});
