import { useCallback, useEffect, useSyncExternalStore } from "react";
import { conFundidoCircular } from "../lib/fundidoDeTema.js";

/* El tema del sitio: claro u oscuro.
 *
 * UNA SOLA FUENTE DE VERDAD: el atributo `data-theme` de <html>. `public/tema.js`
 * lo fija antes de pintar (lo elegido o, si no, el sistema); este hook no guarda
 * una copia: lo lee de ahí y se entera cuando cambia. Así no puede haber un
 * botón que diga «modo claro» con la página en oscuro.
 *
 * useSyncExternalStore y no useState, por la hidratación: el HTML sale del
 * prerender, que no sabe qué tema eligió cada persona y dibuja el botón como
 * en claro. Durante la hidratación React usa `delServidor` —«light», igual que
 * el HTML— y enseguida redibuja con el tema real. Con useState el primer dibujo
 * del navegador no coincidía con el del servidor.
 *
 * Los íconos del botón los elige el CSS por `data-theme`, así que cambian en el
 * mismo cuadro que la página, dentro de la View Transition.
 *
 * La clave y los valores tienen que ser los mismos que en tema.js. Lo cuida
 * tests/temaDelSitio.test.js. */
export const CLAVE_TEMA = "tpp-tema";

const leer = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const delServidor = () => "light";

const suscribir = (avisar) => {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
};

const eligioAlguien = () => document.documentElement.dataset.themePreference !== "system";

const aplicar = (tema, preferencia) => {
  const raiz = document.documentElement;
  raiz.dataset.theme = tema;
  raiz.dataset.themePreference = preferencia;
};

export const useTema = () => {
  const tema = useSyncExternalStore(suscribir, leer, delServidor);

  /* Sin elección propia, el sitio sigue al sistema también en vivo (el
     teléfono que pasa a oscuro a la noche). */
  useEffect(() => {
    let consulta;
    try {
      consulta = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const alCambiarElSistema = (e) => {
      if (!eligioAlguien()) aplicar(e.matches ? "dark" : "light", "system");
    };
    consulta.addEventListener?.("change", alCambiarElSistema);
    return () => consulta.removeEventListener?.("change", alCambiarElSistema);
  }, []);

  const alternar = useCallback((evento) => {
    const nuevo = leer() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(CLAVE_TEMA, nuevo);
    } catch {
      /* sin almacenamiento: el cambio vale para esta visita */
    }
    /* El tema nuevo se abre en círculo desde el botón (ver lib/fundidoDeTema). */
    conFundidoCircular(evento, () => aplicar(nuevo, nuevo));
  }, []);

  return { tema, oscuro: tema === "dark", alternar };
};
