import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import ThemeLogo from "../../src/components/ui/ThemeLogo";

/* EL MONOGRAMA CON FONDO TRANSPARENTE.
 *
 * Mientras los PNG traían el fondo pegado, cada archivo cargaba su propio
 * contraste: el claro venía sobre una placa blanca y se leía hasta sobre el
 * navy del footer. Con canal alfa eso se termina, y la variante ya no puede
 * elegirse solo por el tema de la app: lo que manda es el color de la
 * SUPERFICIE que queda detrás del logo. Estos tests fijan eso:
 *
 * 1. Sin `surface`, sigue el tema (navbar, portal, login, mantenimiento). Lo
 *    hace con CSS: el HTML trae las dos variantes y ThemeLogo.css muestra la de
 *    `data-theme`. Así sirve también en la portada prerenderizada, antes de que
 *    corra React (jsdom no aplica esa hoja: acá se verifica el marcado).
 * 2. Con `surface`, la superficie le gana al tema (footer, CTA y éxito de
 *    reserva son oscuros en los dos temas; la caja del loader es clara en los
 *    dos). Sin esto, el navy sobre el navy del footer desaparece.
 * 3. Que el navegador reciba archivos de 168 y 336 px y el tamaño al que se
 *    dibuja, para que elija por densidad de pantalla y no baje 1254 px para
 *    un logo de 38.
 */

const imagenes = (container) => [...container.querySelectorAll("img")];

describe("ThemeLogo monograma", () => {
  test("sin superficie declarada trae las dos variantes y el CSS elige por tema", () => {
    const { container } = render(<ThemeLogo />);
    const [clara, oscura] = imagenes(container);
    expect(imagenes(container)).toHaveLength(2);
    expect(clara.className).toMatch(/theme-logo__image--claro/);
    expect(clara.getAttribute("src")).toMatch(/brand-logo-monogram-light-168\.png/);
    expect(oscura.className).toMatch(/theme-logo__image--oscuro/);
    expect(oscura.getAttribute("src")).toMatch(/brand-logo-monogram-dark-168\.png/);
  });

  test("la superficie oscura le gana al tema: una sola imagen, la oscura", () => {
    const { container } = render(<ThemeLogo surface="dark" />);
    expect(imagenes(container)).toHaveLength(1);
    expect(imagenes(container)[0].getAttribute("src")).toMatch(/brand-logo-monogram-dark-168\.png/);
  });

  test("la superficie clara le gana al tema: una sola imagen, la clara", () => {
    const { container } = render(<ThemeLogo surface="light" />);
    expect(imagenes(container)).toHaveLength(1);
    expect(imagenes(container)[0].getAttribute("src")).toMatch(/brand-logo-monogram-light-168\.png/);
  });

  test("una superficie mal escrita no rompe la página: vuelve a seguir el tema", () => {
    const { container } = render(<ThemeLogo surface="oscuro" />);
    expect(imagenes(container)).toHaveLength(2);
  });

  test("ofrece 168 y 336 px y declara las dimensiones del archivo chico", () => {
    const { container } = render(<ThemeLogo />);
    for (const img of imagenes(container)) {
      const srcSet = img.getAttribute("srcset");
      expect(srcSet).toMatch(/-168\.png 168w/);
      expect(srcSet).toMatch(/-336\.png 336w/);
      expect(img).toHaveAttribute("sizes", "56px");
      expect(img).toHaveAttribute("width", "168");
      expect(img).toHaveAttribute("height", "168");
    }
  });

  test("quien lo dibuja más grande lo avisa con sizes", () => {
    const { container } = render(<ThemeLogo sizes="112px" />);
    for (const img of imagenes(container)) expect(img).toHaveAttribute("sizes", "112px");
  });

  test("la clase de lugar llega a las dos variantes", () => {
    const { container } = render(<ThemeLogo imgClassName="tpp-nav-mark" />);
    for (const img of imagenes(container)) expect(img.className).toMatch(/tpp-nav-mark/);
  });
});

describe("ThemeLogo lockup", () => {
  test("el lockup con tagline queda como el original, sin srcSet de monograma", () => {
    const { container } = render(<ThemeLogo variant="tagline" />);
    const [img] = imagenes(container);
    expect(imagenes(container)).toHaveLength(1);
    expect(img.getAttribute("src")).toMatch(/brand-logo-main-tagline\.png/);
    expect(img).not.toHaveAttribute("srcset");
    expect(img).not.toHaveAttribute("sizes");
    expect(img).toHaveAttribute("width", "1536");
  });
});
