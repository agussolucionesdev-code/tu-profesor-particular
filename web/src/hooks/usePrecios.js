import { useEffect, useState } from "react";
import { API_BASE } from "../data/api.js";
import { armarGrilla, descuentoVigente } from "../data/precios.js";

/* La grilla de precios, leída en vivo del sistema de turnos.
 *
 * Arranca en "cargando" también en el prerender, que corre en Node sin red: el
 * HTML publicado sale con el texto de respaldo y el navegador lo reemplaza por
 * los números cuando llegan. Así el servidor y el navegador pintan lo mismo en
 * el primer cuadro y React no tiene nada que corregir al hidratar.
 *
 * El backend está en Render y, si estuvo quieto, puede tardar en despertar: por
 * eso hay un tope. Pasado ese tope —o ante cualquier error— el estado queda en
 * "sin datos" y la página manda a ver el precio al reservar. Nunca se muestra
 * un número que no vino del servidor. */
const TOPE_MS = 25000;

export default function usePrecios() {
  const [estado, setEstado] = useState({ fase: "cargando", filas: [], descuento: null });

  useEffect(() => {
    const control = new AbortController();
    const tope = setTimeout(() => control.abort(), TOPE_MS);
    /* El abort lo dispara tanto el tope como el desmontaje. Hay que distinguirlos:
       vencido el tope, la página tiene que pasar a «sin datos»; desmontada, no hay
       a quién avisarle. */
    let desmontado = false;

    fetch(`${API_BASE}/api/settings`, { signal: control.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((cuerpo) => {
        if (desmontado) return;
        const matriz = (cuerpo?.data ?? cuerpo)?.["booking.pricingMatrix"];
        const filas = armarGrilla(matriz);
        setEstado(
          filas.length
            ? { fase: "listo", filas, descuento: descuentoVigente(matriz) }
            : { fase: "sin-datos", filas: [], descuento: null },
        );
      })
      .catch(() => {
        if (!desmontado) setEstado({ fase: "sin-datos", filas: [], descuento: null });
      })
      .finally(() => clearTimeout(tope));

    return () => {
      desmontado = true;
      clearTimeout(tope);
      control.abort();
    };
  }, []);

  return estado;
}
