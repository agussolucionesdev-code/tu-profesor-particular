import { useEffect, useState } from "react";
import { API_BASE } from "../api/apiClient";
import { comprobarServidor } from "../utils/comprobarServidor";

/* ¿ESTÁ VIVO EL SERVIDOR?
 *
 * Antes, toda ruta menos la portada esperaba a este chequeo detrás de un
 * cargador, con 12 s de tope, y si no llegaba mostraba MANTENIMIENTO. Dos
 * problemas, medidos:
 *
 *   · Una familia que entraba directo a /reservar (un enlace compartido) miraba
 *     un cargador aunque el primer paso del kiosco no necesita al servidor.
 *   · El backend vive en Render, que lo duerme cuando no se usa y tarda de 30 a
 *     50 s en despertarlo. A los 12 s el chequeo se rendía y la app decía «en
 *     mantenimiento» de un servidor que sólo se estaba levantando.
 *
 * Ahora la página se dibuja al instante y esto corre de fondo: el primer pedido
 * además despierta al servidor. Se declara CAÍDO sólo si fallan todos los
 * intentos, con paciencia suficiente para un arranque en frío.
 */

/**
 * @returns {"comprobando" | "ok" | "caido"}
 */
export default function useEstadoDelServidor() {
  const [estado, setEstado] = useState("comprobando");

  useEffect(() => {
    const control = new AbortController();
    comprobarServidor({ base: API_BASE, senal: control.signal }).then((resultado) => {
      if (!control.signal.aborted) setEstado(resultado);
    });
    return () => control.abort();
  }, []);

  return estado;
}
