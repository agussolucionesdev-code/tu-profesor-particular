import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import ThemeLogo from "../../src/components/ui/ThemeLogo";

/* EL MONOGRAMA CON FONDO TRANSPARENTE.
 *
 * Mientras los PNG traían el fondo pegado, cada archivo cargaba su propio
 * contraste: el claro venía sobre una placa blanca y se leía hasta sobre el
 * navy del footer. Con canal alfa eso se termina, y la variante ya no puede
 * elegirse solo por el tema de la app: lo que manda es el color de la
 * SUPERFICIE que queda detrás del logo. Estos tests fijan eso:
 *
 * 1. Sin `surface`, sigue el tema (navbar, portal, login, mantenimiento).
 * 2. Con `surface`, la superficie le gana al tema (footer, CTA y éxito de
 *    reserva son oscuros en los dos temas; la caja del loader es clara en los
 *    dos). Sin esto, el navy sobre el navy del footer desaparece.
 * 3. Que el navegador reciba archivos de 168 y 336 px y el tamaño al que se
 *    dibuja, para que elija por densidad de pantalla y no baje 1254 px para
 *    un logo de 38.
 */

const setTheme = (theme) => {
  act(() => {
    document.documentElement.dataset.theme = theme;
  });
};

const img = () => screen.getByRole("img", { name: "Tu Profesor Particular" });

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("ThemeLogo monograma", () => {
  test("sin superficie declarada sigue el tema de la app", async () => {
    setTheme("light");
    render(<ThemeLogo />);
    expect(img().getAttribute("src")).toMatch(/brand-logo-monogram-light-168\.png/);

    setTheme("dark");
    // El MutationObserver dispara en una microtarea.
    await act(async () => {});
    expect(img().getAttribute("src")).toMatch(/brand-logo-monogram-dark-168\.png/);
  });

  test("la superficie oscura le gana al tema claro", () => {
    setTheme("light");
    render(<ThemeLogo surface="dark" />);
    expect(img().getAttribute("src")).toMatch(/brand-logo-monogram-dark-168\.png/);
  });

  test("la superficie clara le gana al tema oscuro", () => {
    setTheme("dark");
    render(<ThemeLogo surface="light" />);
    expect(img().getAttribute("src")).toMatch(/brand-logo-monogram-light-168\.png/);
  });

  test("una superficie mal escrita no rompe la página: vuelve a seguir el tema", () => {
    setTheme("dark");
    render(<ThemeLogo surface="oscuro" />);
    expect(img().getAttribute("src")).toMatch(/brand-logo-monogram-dark-168\.png/);
  });

  test("ofrece 168 y 336 px y declara las dimensiones del archivo chico", () => {
    setTheme("light");
    render(<ThemeLogo />);
    const srcSet = img().getAttribute("srcset");
    expect(srcSet).toMatch(/brand-logo-monogram-light-168\.png 168w/);
    expect(srcSet).toMatch(/brand-logo-monogram-light-336\.png 336w/);
    expect(img()).toHaveAttribute("sizes", "56px");
    expect(img()).toHaveAttribute("width", "168");
    expect(img()).toHaveAttribute("height", "168");
  });

  test("quien lo dibuja más grande lo avisa con sizes", () => {
    render(<ThemeLogo sizes="112px" />);
    expect(img()).toHaveAttribute("sizes", "112px");
  });
});

describe("ThemeLogo lockup", () => {
  test("el lockup con tagline queda como el original, sin srcSet de monograma", () => {
    render(<ThemeLogo variant="tagline" />);
    expect(img().getAttribute("src")).toMatch(/brand-logo-main-tagline\.png/);
    expect(img()).not.toHaveAttribute("srcset");
    expect(img()).not.toHaveAttribute("sizes");
    expect(img()).toHaveAttribute("width", "1536");
  });
});
