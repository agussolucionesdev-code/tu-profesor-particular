import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { RUTA_DE_RESERVA, rutaVirtual } from "../../utils/rutaVirtual";

/* Vercel Analytics con los pasos del kiosco como páginas (ver utils/rutaVirtual).
 *
 * Con `route` y `path`, el componente deja de contar solo y registra una
 * página vista cada vez que cambian: la ruta real al navegar y, dentro de
 * /reservar, la del paso en el que está la persona.
 *
 * Seguro para la privacidad: las rutas de esta app son estáticas y el token de
 * gestión viaja en el fragmento (#), que no forma parte de `pathname`. */
const AnaliticaDeTurnos = () => {
  const { pathname } = useLocation();
  const [virtual, setVirtual] = useState(null);

  useEffect(() => {
    if (pathname !== RUTA_DE_RESERVA) return undefined;
    const alPasar = (e) => {
      const ruta = rutaVirtual(e.detail);
      if (ruta) setVirtual(ruta);
    };
    window.addEventListener("booking:funnel", alPasar);
    return () => {
      window.removeEventListener("booking:funnel", alPasar);
      setVirtual(null);
    };
  }, [pathname]);

  const ruta = pathname === RUTA_DE_RESERVA && virtual ? virtual : pathname;
  return <Analytics route={ruta} path={ruta} />;
};

export default AnaliticaDeTurnos;
