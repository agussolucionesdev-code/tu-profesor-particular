import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import App from "../../src/App";
import { HomePage } from "../../src/paginas";

/* LA PORTADA SE HIDRATA SOBRE EL HTML DEL PRERENDER.
 *
 * Con createRoot, React reemplazaba los nodos del HTML prerenderizado por nodos
 * nuevos y las animaciones de entrada del título volvían a arrancar: en un
 * celular lento, el título se veía, desaparecía y entraba otra vez. Ahora se
 * hidrata, y eso sólo funciona si el primer dibujo del navegador es IGUAL al
 * HTML. Si no, React 19 descarta el HTML entero y dibuja de cero (el mismo
 * parpadeo), o deja atributos viejos sin corregir.
 *
 * El HTML sale del prerender REAL (prerender.mjs), en un proceso de Node sin
 * navegador, como en el build. Se hidrata con el estado de alguien que vuelve:
 * modo oscuro, voz activada, invitación ya vista, con IntersectionObserver.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* Las imágenes con la misma URL que les da Vitest (/src/…), para que la
   comparación sea del marcado y no de cómo se sirven los archivos. */
const htmlDelServidor = () =>
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import path from "node:path";
        import { compilar, renderizarPortada } from ${JSON.stringify(pathToFileURL(path.join(RAIZ, "prerender.mjs")).href)};
        const raiz = ${JSON.stringify(RAIZ)};
        const { default: App } = await compilar(path.join(raiz, "src/App.jsx"), (a) => "/" + path.relative(raiz, a).split(path.sep).join("/"));
        process.stdout.write(await renderizarPortada(App));
      `,
    ],
    { cwd: RAIZ, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

const alguienQueVuelve = () => {
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
};

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("la portada prerenderizada", () => {
  test("se hidrata sin desajustes, con los mismos nodos, y después muestra el estado real", async () => {
    const html = htmlDelServidor();
    alguienQueVuelve();

    const raiz = document.createElement("div");
    raiz.id = "root";
    raiz.innerHTML = html;
    document.body.append(raiz);
    const tituloDelHtml = raiz.querySelector("h1");
    expect(tituloDelHtml).not.toBeNull();

    const problemas = [];
    vi.spyOn(console, "error").mockImplementation((...partes) => {
      const texto = partes.map(String).join(" ");
      if (/hydrat|did(n't| not) match|server rendered/i.test(texto)) problemas.push(texto.slice(0, 400));
    });

    await HomePage.precargar();
    let root;
    await act(async () => {
      root = hydrateRoot(raiz, <App />, {
        onRecoverableError: (error) => problemas.push(`recuperable: ${error.message.slice(0, 400)}`),
      });
    });

    expect(problemas).toEqual([]);
    /* Adoptó el HTML: el título es el MISMO nodo, así que su animación no
       vuelve a arrancar. */
    expect(raiz.querySelector("h1")).toBe(tituloDelHtml);

    /* Y enseguida pasa a lo real: modo oscuro y voz activa. */
    const botonesDeTema = raiz.querySelectorAll(".tpp-nav-theme");
    expect(botonesDeTema.length).toBeGreaterThan(0);
    for (const boton of botonesDeTema) expect(boton).toHaveAttribute("aria-label", "Cambiar a modo claro");
    for (const boton of raiz.querySelectorAll(".tpp-nav-voice")) expect(boton).toHaveAttribute("aria-pressed", "true");

    act(() => root.unmount());
    raiz.remove();
  }, 90_000);
});
