/* ¿Contesta el servidor? Sin React ni Vite: se prueba en Node.
 * El porqué de los números está en src/hooks/useEstadoDelServidor.js. */

/* Tres intentos de 20 s con una pausa corta: cubre holgado el minuto que puede
   tardar Render en despertar. */
export const INTENTOS = 3;
export const TIEMPO_POR_INTENTO = 20_000;
export const PAUSA_ENTRE_INTENTOS = 2_000;

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Pregunta por /health hasta que conteste bien o se acaben los intentos.
 * Separada del hook para poder probarla sin React ni red.
 *
 * @returns {Promise<"ok" | "caido">}
 */
export async function comprobarServidor({
  pedir = (url, opciones) => fetch(url, opciones),
  base,
  intentos = INTENTOS,
  tiempoPorIntento = TIEMPO_POR_INTENTO,
  pausa = PAUSA_ENTRE_INTENTOS,
  senal,
} = {}) {
  for (let intento = 1; intento <= intentos; intento++) {
    if (senal?.aborted) return "caido";
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), tiempoPorIntento);
    const alAbortar = () => corte.abort();
    senal?.addEventListener("abort", alAbortar);
    try {
      const respuesta = await pedir(`${base}/health`, { signal: corte.signal });
      if (respuesta.ok) return "ok";
    } catch {
      /* red caída, CORS o tiempo agotado: se reintenta */
    } finally {
      clearTimeout(reloj);
      senal?.removeEventListener("abort", alAbortar);
    }
    if (intento < intentos) await esperar(pausa);
  }
  return "caido";
}
