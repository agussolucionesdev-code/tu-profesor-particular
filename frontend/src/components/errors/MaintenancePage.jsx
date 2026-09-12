import ErrorPageLayout from "./ErrorPageLayout";
import ThemeLogo from "../ui/ThemeLogo";
import { waLink } from "../../constants/contactChannels";
import "./MaintenancePage.css";

/* ══════════════════════════════════════════════════════════════════════════
   LA PANTALLA DE MANTENIMIENTO.

   Es la que aparece cuando el backend no responde: alguien entró a reservar
   una clase y se encontró con que no puede. Eso la convierte en la pantalla
   más delicada del sitio, porque es la única que puede perder a una persona
   que ya había decidido venir.

   POR QUÉ WHATSAPP ES LA ACCIÓN PRINCIPAL

   Antes el único botón era «Reintentar», que devuelve a la persona al mismo
   lugar donde ya estaba. Si el sistema está caído, reintentar es un bucle. La
   acción que de verdad resuelve el problema de quien está mirando esta
   pantalla es hablar con Agustín, y por eso va primera. «Reintentar» queda
   como segunda, para quien vuelve un rato después.

   POR QUÉ LOS ENGRANAJES ESTÁN CALCULADOS

   Un engranaje quieto y mal dibujado pasa desapercibido. Uno que gira, no:
   cualquier irregularidad en el paso de los dientes se ve como un temblor en
   cada vuelta. Así que las dos ruedas se generaron con geometría —quince
   dientes la grande, siete la chica, el mismo paso circular en las dos— y
   giran a velocidades inversamente proporcionales a sus dientes y en sentidos
   opuestos, que es lo que hacen dos engranajes que se tocan de verdad: la
   chica da 15/7 de vuelta por cada vuelta de la grande. Ese detalle es todo
   lo que separa «una imagen que rota» de «una máquina trabajando».

   La distancia entre los centros es la suma de los radios primitivos más
   cuatro: engranados exactos, los dientes rectos se interpenetrarían, porque
   para eso los engranajes reales usan perfil de involuta y estos no. Con esos
   cuatro píxeles de aire los dientes se persiguen sin cruzarse.
   ══════════════════════════════════════════════════════════════════════════ */

const RUEDA_GRANDE =
  "M86.44 84.43L87.19 74.25L96.81 74.25L97.56 84.43A36 36 0 0 1 101.39 85.25L106.21 76.25L115 80.16L111.54 89.77A36 36 0 0 1 114.71 92.07L122.78 85.82L129.21 92.96L122.15 100.33A36 36 0 0 1 124.11 103.72L134.02 101.29L136.99 110.44L127.54 114.29A36 36 0 0 1 127.95 118.19L138 120L136.99 129.56L126.79 129.24A36 36 0 0 1 125.58 132.97L134.02 138.71L129.21 147.04L120.02 142.6A36 36 0 0 1 117.4 145.51L122.78 154.18L115 159.84L108.41 152.04A36 36 0 0 1 104.83 153.64L106.21 163.75L96.81 165.75L93.96 155.95A36 36 0 0 1 90.04 155.95L87.19 165.75L77.79 163.75L79.17 153.64A36 36 0 0 1 75.59 152.04L69 159.84L61.22 154.18L66.6 145.51A36 36 0 0 1 63.98 142.6L54.79 147.04L49.98 138.71L58.42 132.97A36 36 0 0 1 57.21 129.24L47.01 129.56L46 120L56.05 118.19A36 36 0 0 1 56.46 114.29L47.01 110.44L49.98 101.29L59.89 103.72A36 36 0 0 1 61.85 100.33L54.79 92.96L61.22 85.82L69.29 92.07A36 36 0 0 1 72.46 89.77L69 80.16L77.79 76.25L82.61 85.25A36 36 0 0 1 86.44 84.43Z";

const RUEDA_CHICA =
  "M133.72 56.92L133.24 46.67L145.16 46.67L144.68 56.92A16.8 16.8 0 0 1 148.2 58.62L155.91 51.85L163.35 61.17L155.03 67.18A16.8 16.8 0 0 1 155.9 70.99L166 72.8L163.35 84.43L153.46 81.67A16.8 16.8 0 0 1 151.03 84.73L155.91 93.75L145.16 98.93L141.16 89.49A16.8 16.8 0 0 1 137.24 89.49L133.24 98.93L122.49 93.75L127.37 84.73A16.8 16.8 0 0 1 124.94 81.67L115.05 84.43L112.4 72.8L122.5 70.99A16.8 16.8 0 0 1 123.37 67.18L115.05 61.17L122.49 51.85L130.2 58.62A16.8 16.8 0 0 1 133.72 56.92Z";

const Engranajes = () => (
  <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* La rueda grande. El relleno tenue le da cuerpo: con solo el contorno,
        a esta escala la figura se ve como un alambre. */}
    <g className="mant-rueda mant-rueda--grande">
      <path d={RUEDA_GRANDE} className="mant-diente" />
      <circle cx="92" cy="120" r="13.5" className="mant-eje" />
    </g>

    <g className="mant-rueda mant-rueda--chica">
      <path d={RUEDA_CHICA} className="mant-diente" />
      <circle cx="139.2" cy="72.8" r="6.4" className="mant-eje" />
    </g>

    {/* Los tres puntos dicen «esto sigue trabajando» sin escribirlo. Se
        encienden en secuencia, no los tres a la vez. */}
    <g className="mant-puntos">
      <circle cx="94" cy="195" r="4.5" />
      <circle cx="110" cy="195" r="4.5" />
      <circle cx="126" cy="195" r="4.5" />
    </g>
  </svg>
);

const MaintenancePage = () => {
  return (
    <ErrorPageLayout
      className="error-page--mantenimiento"
      /* Esta pantalla se dibuja antes del Navbar, así que el monograma es lo
         único que le dice a la persona que sigue en el sitio de Agustín. */
      brand={<ThemeLogo variant="monogram" alt="Tu Profesor Particular" />}
      illustration={<Engranajes />}
      title="Los turnos vuelven en un rato"
      /* Primera persona, porque acá atiende una persona y no una empresa: es
         el diferencial de Agustín y también lo honesto. Y «mantenimiento»
         describe bien lo que la persona ve, tanto si la actualización es
         planeada como si algo se cayó solo. */
      description="El sistema de turnos está en mantenimiento. Si tu clase es para hoy o mañana, escribime por WhatsApp y la agendamos ahora mismo."
      actions={[
        {
          label: "Escribime por WhatsApp",
          href: waLink(
            "Hola Agustín, quiero reservar una clase y la web está en mantenimiento.",
          ),
          external: true,
        },
        { label: "Reintentar", onClick: () => window.location.reload() },
      ]}
    />
  );
};

export default MaintenancePage;
