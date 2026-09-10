/* La matriz de precios: nivel × materia → tarifa por hora.
 *
 * POR QUÉ EXISTE
 *
 * Había UN solo precio por hora para todo el servicio. Pero el precio real es una
 * matriz: primaria no vale lo mismo que universitario, y dentro de secundaria las
 * ciencias duras valen más que Lengua. Con un único número, el kiosco mostraba un
 * estimado equivocado para casi toda combinación. Y mostrar un precio MENOR al real y
 * corregirlo después es peor que no mostrar ninguno: es exactamente la reserva que hay
 * que cancelar.
 *
 * POR QUÉ NO ES UNA IA, que fue la primera idea sobre la mesa
 *
 * La entrada es nivel + materia + duración. La salida es un número. Es una función
 * DETERMINÍSTICA: no hay ambigüedad que interpretar ni lenguaje natural que entender.
 * Un modelo ahí sería no determinista —la misma reserva podría cotizar distinto dos
 * veces—, podría alucinar un precio que no está en ninguna tabla, costaría una llamada
 * de red por reserva en el paso donde la gente decide, y sería imposible de testear.
 * Cuando la respuesta se puede escribir como regla, se escribe. Esto es una regla.
 *
 * LA REGLA QUE NO SE PUEDE ROMPER
 *
 *   Si una combinación no tiene tarifa, se devuelve `null`. NUNCA cero.
 *
 * Un cero se convierte en "$0" en pantalla y se lee como "es gratis": una promesa que
 * el negocio no hizo. Y el caso es real: el profesor edita esto a mano desde el panel y
 * puede dejar un nivel sin cargar.
 *
 * LA CADENA DE RESOLUCIÓN, de más específico a menos:
 *
 *   excepción(nivel, materia) → base(nivel) → tarifa general → null
 *
 * La tarifa general es `booking.pricePerHour`, el único número que existía antes de
 * esto. Sigue siendo la red de última instancia, y por eso estrenar la matriz no le
 * cambia el precio a nadie de un día para el otro.
 */

/* Los valores acordados con Agustín, contrastados contra el mercado relevado
   (TusClases, rangos de profesores activos reales).

   Primaria a $16.000 NO es un aumento: cobraba $12.000 cuando el piso relevado era
   $16.140. Es dejar de estar por debajo del piso.

   No hay nivel de Programación a propósito: la da, pero decidió no cobrarla aparte. */
export const DEFAULT_PRICING_MATRIX = Object.freeze({
  porNivel: Object.freeze({
    Primaria: 16000,
    Secundaria: 20000,
    // Sin tilde: es la clave que usa LEVEL_OPTIONS en el frontend.
    "Secundaria Tecnica": 25000,
    Terciario: 30000,
    Universitario: 30000,
  }),
  excepciones: Object.freeze([
    Object.freeze({
      nivel: "Secundaria",
      materias: Object.freeze(["Matemática", "Física", "Química", "Fisicoquímica"]),
      precio: 25000,
    }),
  ]),
  /* Desde 2 horas, −10%. Los dos números importan:
     - 2 horas es la duración que el wizard ya recomienda por defecto, así que el precio
       y el producto empujan para el mismo lado.
     - −10% sobre $25.000 da $22.500, que es prácticamente el descuento de $22.000 que
       Agustín ya hacía a mano. No se inventó una política: se formalizó la que existía. */
  descuento: Object.freeze({ desdeHoras: 2, porcentaje: 10 }),
});

/* Un importe usable, o null. Vacío, cero, negativo o texto significan todos lo mismo:
   "sin tarifa configurada". */
const importeUsable = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

/* Las materias se comparan sin tildes de más ni mayúsculas: el valor llega como texto
   libre desde el paso 1 y también se puede escribir a mano con "Otra materia", así que
   "  física  " y "Física" tienen que ser la misma clase. */
/* La clave con la que se comparan los nombres de materia.
 *
 * ESTO EMPEZÓ COBRANDO DE MENOS. El sitio institucional enlazaba
 * `/reservar?materia=Matemáticas` —en plural, porque ahí el título de la tarjeta
 * dice "Matemáticas"— y el kiosco guardaba ese texto tal cual. La excepción de
 * precios está cargada como "Matemática", en singular, así que la comparación
 * fallaba y una clase de Secundaria se cotizaba a la tarifa base: $20.000 en
 * lugar de $25.000. En la materia más pedida, y entrando desde el propio sitio.
 *
 * La causa se corrigió en el origen (el institucional ahora manda el nombre
 * canónico) y en el kiosco (normaliza lo que llega por la URL), pero esta capa
 * es la que garantiza el precio: los enlaces con el plural ya se compartieron
 * por WhatsApp y van a seguir existiendo para siempre, y el servidor es el único
 * lugar donde la tarifa se decide de verdad.
 *
 * Normaliza tres cosas, y ninguna más:
 *   - mayúsculas          "Física"   -> "fisica"
 *   - tildes y diéresis   "Matemática" -> "matematica"
 *   - una "s" final       "Matemáticas" -> "matematica"
 *
 * La "s" se saca de LOS DOS lados de la comparación, así que las materias que
 * son plurales de nacimiento —"Ciencias Naturales", "Prácticas Docentes"— se
 * normalizan igual y siguen coincidiendo consigo mismas.
 *
 * Lo que NO hace: distancia de edición ni sinónimos. "Matematica" sin tilde
 * coincide, "Mate" no. Adivinar de más sería cobrar una tarifa que el alumno no
 * eligió, y ese error es peor que el que esto viene a arreglar. */
const clave = (valor) => {
  if (typeof valor !== "string") return "";
  const limpio = valor
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Sólo la "s" del final, y sólo si queda algo antes: "s" a secas no es plural.
  return limpio.length > 1 ? limpio.replace(/s$/, "") : limpio;
};

const textoUsable = (valor) => {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  return limpio.length > 0 ? limpio : null;
};

const normalizarDescuento = (valor) => {
  const desdeHoras = Number(valor?.desdeHoras);
  const porcentaje = Number(valor?.porcentaje);
  return {
    desdeHoras: Number.isFinite(desdeHoras) && desdeHoras > 0 ? desdeHoras : null,
    /* Estrictamente entre 0 y 100. Un 0 no es un descuento y un 100 regala la clase;
       los dos suelen ser un error de carga, no una decisión comercial. */
    porcentaje:
      Number.isFinite(porcentaje) && porcentaje > 0 && porcentaje < 100 ? porcentaje : null,
  };
};

/* Deja la matriz en una forma en la que el resto del módulo puede confiar.
 *
 * Es lo primero que toca el dato porque la matriz la edita una persona y se guarda como
 * JSON: puede llegar con cualquier forma. Una matriz corrupta no puede tumbar el paso 3
 * del kiosco ni la creación de una reserva — como mucho deja de haber precio, y eso ya
 * está contemplado.
 *
 * Es idempotente: normalizar lo ya normalizado devuelve lo mismo. */
export const normalizarMatriz = (valor) => {
  const crudo = valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};

  const porNivel = {};
  const nivelesCrudos =
    crudo.porNivel && typeof crudo.porNivel === "object" && !Array.isArray(crudo.porNivel)
      ? crudo.porNivel
      : {};
  for (const [nivel, precio] of Object.entries(nivelesCrudos)) {
    const nombre = textoUsable(nivel);
    const importe = importeUsable(precio);
    if (nombre && importe !== null) porNivel[nombre] = importe;
  }

  const excepciones = (Array.isArray(crudo.excepciones) ? crudo.excepciones : [])
    .map((e) => {
      if (!e || typeof e !== "object") return null;
      const nivel = textoUsable(e.nivel);
      const precio = importeUsable(e.precio);
      const materias = (Array.isArray(e.materias) ? e.materias : [])
        .map(textoUsable)
        .filter(Boolean);
      // Una excepción sin nivel, sin materias o sin precio no describe nada.
      if (!nivel || precio === null || materias.length === 0) return null;
      return { nivel, materias, precio };
    })
    .filter(Boolean);

  return { porNivel, excepciones, descuento: normalizarDescuento(crudo.descuento) };
};

/**
 * La tarifa por hora de una combinación, o null si no hay ninguna.
 *
 * `tarifaGeneral` es la red de última instancia (`booking.pricePerHour`).
 */
export const resolverTarifa = (matriz, { nivel, materia, tarifaGeneral } = {}) => {
  const m = matriz?.porNivel ? matriz : normalizarMatriz(matriz);
  const nombreNivel = textoUsable(nivel);
  const red = importeUsable(tarifaGeneral);
  if (!nombreNivel) return red;

  const materiaClave = clave(materia);
  if (materiaClave) {
    const excepcion = m.excepciones.find(
      (e) => e.nivel === nombreNivel && e.materias.some((x) => clave(x) === materiaClave),
    );
    if (excepcion) return excepcion.precio;
  }

  return importeUsable(m.porNivel[nombreNivel]) ?? red;
};

/**
 * La tarifa con el descuento por varias horas ya aplicado.
 * Devuelve la tarifa intacta cuando no corresponde descuento.
 */
export const aplicarDescuento = (tarifaPorHora, duracionHoras, descuento) => {
  const tarifa = importeUsable(tarifaPorHora);
  if (tarifa === null) return tarifa;

  const { desdeHoras, porcentaje } = normalizarDescuento(descuento);
  const horas = Number(duracionHoras);
  if (desdeHoras === null || porcentaje === null) return tarifa;
  if (!Number.isFinite(horas) || horas < desdeHoras) return tarifa;

  // A peso entero: nadie cobra centavos y un precio con coma ensucia el KPI de ingresos.
  return Math.round(tarifa * (1 - porcentaje / 100));
};

/**
 * La cotización completa de una reserva, o `null` si no hay tarifa para esa
 * combinación.
 *
 * Devuelve `null` entero y no `{ price: 0 }` a propósito: quien lo use tiene que decidir
 * entre mostrar el bloque de precio o no mostrarlo, en lugar de recibir ceros y tener
 * que acordarse de chequearlos en cada pantalla.
 */
export const cotizar = (matriz, { nivel, materia, duracionHoras, tarifaGeneral } = {}) => {
  const m = matriz?.porNivel ? matriz : normalizarMatriz(matriz);
  const tarifaBase = resolverTarifa(m, { nivel, materia, tarifaGeneral });
  const horas = Number(duracionHoras);
  if (tarifaBase === null || !Number.isFinite(horas) || horas <= 0) return null;

  const tarifaAplicada = aplicarDescuento(tarifaBase, horas, m.descuento);
  return {
    tarifaBase,
    tarifaAplicada,
    huboDescuento: tarifaAplicada !== tarifaBase,
    price: Math.round(tarifaAplicada * horas),
    duracionHoras: horas,
  };
};
