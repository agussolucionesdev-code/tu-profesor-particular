import { useCallback, useEffect, useState } from "react";
import { conFundidoCircular } from "../lib/fundidoDeTema.js";

/* El tema del sitio: claro u oscuro.
 *
 * `public/tema.js` ya lo fijó en <html> antes de pintar; este hook lo lee de
 * ahí y no de localStorage, para no poder contradecirlo. Si la persona no
 * eligió nada, el sitio sigue al sistema y se entera cuando el sistema cambia
 * (el teléfono que pasa a oscuro a la noche). Cuando toca el botón, esa
 * elección gana y se guarda.
 *
 * La clave y los valores tienen que ser los mismos que en tema.js. Lo cuida
 * tests/temaDelSitio.test.js. */
export const CLAVE_TEMA = "tpp-tema";

const leer = () =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const eligioAlguien = () =>
  typeof document !== "undefined" && document.documentElement.dataset.themePreference !== "system";

const aplicar = (tema, preferencia) => {
  const raiz = document.documentElement;
  raiz.dataset.theme = tema;
  raiz.dataset.themePreference = preferencia;
};

export const useTema = () => {
  const [tema, setTema] = useState(leer);

  useEffect(() => {
    let consulta;
    try {
      consulta = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const alCambiarElSistema = (e) => {
      if (eligioAlguien()) return;
      const nuevo = e.matches ? "dark" : "light";
      aplicar(nuevo, "system");
      setTema(nuevo);
    };
    consulta.addEventListener?.("change", alCambiarElSistema);
    return () => consulta.removeEventListener?.("change", alCambiarElSistema);
  }, []);

  const alternar = useCallback((evento) => {
    const nuevo = leer() === "dark" ? "light" : "dark";
    const cambiar = () => {
      aplicar(nuevo, nuevo);
      setTema(nuevo);
    };
    try {
      window.localStorage.setItem(CLAVE_TEMA, nuevo);
    } catch {
      /* sin almacenamiento: el cambio vale para esta visita */
    }
    /* El tema nuevo se abre en círculo desde el botón (ver lib/fundidoDeTema). */
    conFundidoCircular(evento, cambiar);
  }, []);

  return { tema, oscuro: tema === "dark", alternar };
};
