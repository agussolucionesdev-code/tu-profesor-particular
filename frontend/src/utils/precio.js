/* El precio, formateado y explicado.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * El estimado se mostraba en un solo lugar: el paso 5, el de confirmar. O sea DESPUÉS
 * de que la persona ya entregó nombre, teléfono, email, año, curso y objetivo. El dato
 * que más pesa para decidir llegaba último, cuando ya había invertido cuatro pasos.
 *
 * Un costo que aparece al final es la fuga más silenciosa que tiene un servicio: nadie
 * escribe para quejarse, simplemente cierra la pestaña. Y del otro lado deja una
 * sensación peor que la de un precio alto, que es la de que te lo estaban escondiendo.
 *
 * Ahora se muestra en el paso 3, junto a la duración, que es donde el número se vuelve
 * calculable —precio = tarifa × horas— y donde de verdad informa la decisión: elegir
 * «2 horas» sin ver lo que cuesta no es elegir.
 *
 * SOBRE LA COPIA DE LA LÓGICA, que es lo primero que va a incomodar al leer esto:
 *
 * La resolución de tarifas vive TAMBIÉN en el backend, en `services/pricingMatrix.js`.
 * Son dos proyectos separados, sin paquete compartido, así que la alternativa era
 * pedirle al servidor una cotización en cada cambio de duración del paso 3 —una llamada
 * de red justo en el momento en que la persona está decidiendo—. No vale la pena.
 *
 * La duplicación es SEGURA por cómo está repartida la autoridad: esta copia sólo MUESTRA
 * un estimado, y el precio que se guarda lo recalcula siempre el servidor al crear la
 * reserva. Si algún día divergen, alguien ve un número de referencia levemente distinto
 * —y ya está rotulado como referencia— pero paga el correcto. Lo que NO puede pasar es
 * que el cliente decida el precio, y por eso el backend nunca confía en este archivo.
 *
 * SOBRE EL CERO, que es la regla que no hay que romper: cuando no hay tarifa cargada,
 * estas funciones devuelven `null` y no «$0». Un «$0» se lee como «es gratis» y es una
 * promesa que el negocio no hizo. Preferimos no decir nada antes que decir algo falso.
 */

const FORMATO = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/* Una tarifa usable, o null. El valor llega del endpoint público y lo carga una persona
   en el panel, así que puede venir vacío, en cero, negativo o como texto. */
export const tarifaUsable = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

export const formatearPesos = (monto) => {
  const numero = Number(monto);
  return Number.isFinite(numero) ? FORMATO.format(numero) : null;
};

/* Lo que cuesta UNA clase de esa duración. */
export const precioDeUnaClase = (tarifaPorHora, duracionHoras) => {
  const tarifa = tarifaUsable(tarifaPorHora);
  const horas = Number(duracionHoras);
  if (tarifa === null || !Number.isFinite(horas) || horas <= 0) return null;
  return tarifa * horas;
};

/* Las materias se comparan sin mayúsculas ni espacios de más: el valor llega como texto
   libre del paso 1 y también se puede escribir a mano con "Otra materia". */
const clave = (valor) =>
  typeof valor === "string" ? valor.trim().toLocaleLowerCase("es-AR") : "";

const texto = (valor) => {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  return limpio.length > 0 ? limpio : null;
};

/* La tarifa por hora de una combinación, o null.
   Cadena de resolución, de más específico a menos, igual que en el backend:
     excepción(nivel, materia) → base(nivel) → tarifa general → null */
export const resolverTarifa = (matriz, { nivel, materia, tarifaGeneral } = {}) => {
  const red = tarifaUsable(tarifaGeneral);
  const nombreNivel = texto(nivel);
  if (!nombreNivel) return red;

  const excepciones = Array.isArray(matriz?.excepciones) ? matriz.excepciones : [];
  const materiaClave = clave(materia);
  if (materiaClave) {
    const hallada = excepciones.find(
      (e) =>
        texto(e?.nivel) === nombreNivel &&
        (Array.isArray(e?.materias) ? e.materias : []).some((x) => clave(x) === materiaClave),
    );
    const precio = tarifaUsable(hallada?.precio);
    if (precio !== null) return precio;
  }

  return tarifaUsable(matriz?.porNivel?.[nombreNivel]) ?? red;
};

/* El descuento por varias horas, o la tarifa intacta si no corresponde. */
export const aplicarDescuento = (tarifaPorHora, duracionHoras, descuento) => {
  const tarifa = tarifaUsable(tarifaPorHora);
  if (tarifa === null) return null;

  const desdeHoras = Number(descuento?.desdeHoras);
  const porcentaje = Number(descuento?.porcentaje);
  const horas = Number(duracionHoras);
  const descuentoValido =
    Number.isFinite(porcentaje) &&
    porcentaje > 0 &&
    porcentaje < 100 &&
    Number.isFinite(desdeHoras) &&
    desdeHoras > 0;
  if (!descuentoValido || !Number.isFinite(horas) || horas < desdeHoras) return tarifa;

  return Math.round(tarifa * (1 - porcentaje / 100));
};

/* El desglose completo de lo que se está por reservar.
 *
 * Devuelve `null` cuando no hay tarifa: quien lo use tiene que poder decidir entre
 * mostrar el bloque o no mostrarlo, en lugar de recibir ceros y tener que chequearlos.
 *
 * `totalSerie` sólo aparece cuando son varias clases. Es el número que más importa
 * cuando alguien reserva ocho: confirmar una serie viendo sólo el precio por clase es
 * enterarse del total después. */
export const desglosarPrecio = ({
  duracionHoras,
  clases = 1,
  // Camino nuevo: se resuelve la tarifa desde la matriz con el nivel y la materia.
  matriz,
  nivel,
  materia,
  tarifaGeneral,
  /* Una tarifa explícita gana sobre la resolución. Sirve para cotizar un valor puntual
     sin armar una matriz, y es lo que mantiene funcionando a quien ya llamaba así. */
  tarifaPorHora,
}) => {
  const base =
    tarifaUsable(tarifaPorHora) ?? resolverTarifa(matriz, { nivel, materia, tarifaGeneral });
  if (base === null) return null;

  const aplicada = aplicarDescuento(base, duracionHoras, matriz?.descuento);
  const porClase = precioDeUnaClase(aplicada, duracionHoras);
  if (porClase === null) return null;

  const cantidad = Number.isInteger(clases) && clases > 0 ? clases : 1;
  return {
    // La base, sin descuento. Es la que se muestra tachada o se explica.
    tarifaPorHora: base,
    tarifaBaseTexto: formatearPesos(base),
    // La que efectivamente se cobra por hora. Es la que va en pantalla.
    tarifaAplicada: aplicada,
    tarifaTexto: formatearPesos(aplicada),
    huboDescuento: aplicada !== base,
    duracionHoras: Number(duracionHoras),
    clases: cantidad,
    porClase,
    porClaseTexto: formatearPesos(porClase),
    totalSerie: cantidad > 1 ? porClase * cantidad : null,
    totalSerieTexto: cantidad > 1 ? formatearPesos(porClase * cantidad) : null,
  };
};
