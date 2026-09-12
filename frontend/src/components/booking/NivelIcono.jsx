/* ══════════════════════════════════════════════════════════════════════════
   LOS ÍCONOS DE NIVEL.

   POR QUÉ NO SON IMÁGENES

   El paso del nivel y el de la materia son consecutivos. Las portadas de
   materia son las que venden: son las que hacen que alguien reconozca
   «Química» de un vistazo y sienta que ahí está lo que necesita. Si el paso
   anterior también está lleno de ilustración rica, los dos compiten y ninguno
   lidera.

   Elegir el nivel, además, no es una decisión que haya que seducir: es
   administrativa y dura dos segundos. Primaria, Secundaria, CENS. Lo que
   necesita es ser instantánea e inequívoca, no linda.

   Así que acá va lo mínimo que distingue: una silueta por nivel, dibujada en
   código. Nítida a cualquier tamaño, hereda el color de la tarjeta, pesa
   alrededor de un kilobyte las seis juntas contra 254 KB de los renders que
   reemplaza, y no hay una request de red por tarjeta.

   ESTO NO CONTRADICE EL RECHAZO AL «LINE ART»

   Agustín descartó el line art como lenguaje para las PORTADAS, y tenía razón:
   una portada tiene que atraer y un contorno fino no atrae. Pero un ícono de
   interfaz cumple otro papel: ordena, no seduce. Son dos trabajos distintos y
   por eso admiten dos lenguajes distintos.

   CÓMO ESTÁN DIBUJADOS

   Rejilla de 24, trazo de 1.75 con puntas y uniones redondeadas, `currentColor`
   para que sigan al texto de la tarjeta en claro y en oscuro. Cada silueta es
   distinguible de las otras cinco a 28 px y en escala de grises: eso es lo que
   hace que sirvan, no el detalle.
   ══════════════════════════════════════════════════════════════════════════ */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/* Primaria · bloques de encastre. Es el objeto que sólo existe en primaria:
   ningún otro nivel usa bloques para contar. */
const Primaria = () => (
  <>
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
    <rect x="8" y="3" width="8" height="8" rx="1.5" />
  </>
);

/* Secundaria · carpeta abierta con separador. El cuaderno de dos tapas es la
   imagen de la secundaria común. */
const Secundaria = () => (
  <>
    <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4.5A1.5 1.5 0 0 1 3 15.5Z" />
    <path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5A1.5 1.5 0 0 0 21 15.5Z" />
    <path d="M16 8.5h2.5" />
  </>
);

/* Secundaria Técnica · engranaje. El taller es lo que la separa de la
   secundaria común, y es lo que su alumno viene a buscar.

   Esta silueta se calculó, no se dibujó a ojo, y llegó tercera. La primera fue
   un engranaje de ocho dientes sobre un radio de 3.2: a 28 px cada diente
   medía 1.6 px y el conjunto se leía como un asterisco. La segunda fue una
   tuerca hexagonal con el agujero al medio, que a ese tamaño se lee como el
   objetivo de una cámara. Esta tiene seis dientes de 3.7 × 3.9 px reales a
   28 px sobre un radio interior de 6.5 —la rueda ocupa la rejilla entera— y
   ahí el perfil dentado por fin sobrevive. Los arcos entre diente y diente son
   del mismo radio interior, así que el contorno cierra sin lados planos. */
const Tecnica = () => (
  <path d="M9.88 5.85L9.49 2.63L14.51 2.63L14.12 5.85A6.5 6.5 0 0 1 16.26 7.09L18.86 5.14L21.37 9.49L18.38 10.76A6.5 6.5 0 0 1 18.38 13.24L21.37 14.51L18.86 18.86L16.26 16.91A6.5 6.5 0 0 1 14.12 18.15L14.51 21.37L9.49 21.37L9.88 18.15A6.5 6.5 0 0 1 7.74 16.91L5.14 18.86L2.63 14.51L5.62 13.24A6.5 6.5 0 0 1 5.62 10.76L2.63 9.49L5.14 5.14L7.74 7.09A6.5 6.5 0 0 1 9.88 5.85Z" />
);

/* CENS · reloj. La secundaria de adultos se cursa después del trabajo: el
   horario es lo que la define para quien la busca. Iba acompañado de un libro,
   pero dos objetos a 28 px se leen como una mancha; el reloj solo, grande, se
   lee de una. */
const Cens = () => (
  <>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.1V12l3.5 2.1" />
  </>
);

/* Terciario · pizarrón de caballete. El terciario de Agustín es formación
   docente: el aula vista desde adelante. Las dos líneas de escritura son las
   que evitan que se lea como un monitor, y las patas van en V porque el palo
   recto con travesaño daba una T. */
const Terciario = () => (
  <>
    <rect x="3" y="3.2" width="18" height="12.4" rx="1.8" />
    <path d="M7.4 7.9h9.2M7.4 11.3h5.4" />
    <path d="M12 15.6v2.9M8 21l4-2.5 4 2.5" />
  </>
);

/* Universitario · birrete. No hay símbolo más directo, y es el mismo que el
   logo de la marca ya usa. */
const Universitario = () => (
  <>
    <path d="M12 4 2.8 8.2 12 12.4l9.2-4.2Z" />
    <path d="M6.4 10.1v4.6c0 1.7 2.5 3.1 5.6 3.1s5.6-1.4 5.6-3.1v-4.6" />
    <path d="M20.4 9v5.2" />
  </>
);

const POR_NIVEL = {
  Primaria,
  Secundaria,
  "Secundaria Tecnica": Tecnica,
  CENS: Cens,
  Terciario,
  Universitario,
};

export default function NivelIcono({ nivel, size = 28, className = "" }) {
  /* Si mañana se agrega un nivel y nadie dibuja su ícono, cae en el de
     secundaria en vez de romper la tarjeta o dejar un hueco. */
  const Dibujo = POR_NIVEL[nivel] ?? Secundaria;
  return (
    <svg
      {...base}
      width={size}
      height={size}
      className={className}
      /* Decorativo: el nombre del nivel está escrito al lado, en texto, y la
         tarjeta ya tiene su aria-label. Anunciarlo otra vez sería repetirlo. */
      aria-hidden="true"
      focusable="false"
    >
      <Dibujo />
    </svg>
  );
}
