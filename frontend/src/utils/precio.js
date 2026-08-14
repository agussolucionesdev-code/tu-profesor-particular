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

/* El desglose completo de lo que se está por reservar.
 *
 * Devuelve `null` cuando no hay tarifa: quien lo use tiene que poder decidir entre
 * mostrar el bloque o no mostrarlo, en lugar de recibir ceros y tener que chequearlos.
 *
 * `totalSerie` sólo aparece cuando son varias clases. Es el número que más importa
 * cuando alguien reserva ocho: confirmar una serie viendo sólo el precio por clase es
 * enterarse del total después. */
export const desglosarPrecio = ({ tarifaPorHora, duracionHoras, clases = 1 }) => {
  const porClase = precioDeUnaClase(tarifaPorHora, duracionHoras);
  if (porClase === null) return null;

  const cantidad = Number.isInteger(clases) && clases > 0 ? clases : 1;
  return {
    tarifaPorHora: tarifaUsable(tarifaPorHora),
    duracionHoras: Number(duracionHoras),
    clases: cantidad,
    porClase,
    porClaseTexto: formatearPesos(porClase),
    totalSerie: cantidad > 1 ? porClase * cantidad : null,
    totalSerieTexto: cantidad > 1 ? formatearPesos(porClase * cantidad) : null,
    tarifaTexto: formatearPesos(tarifaUsable(tarifaPorHora)),
  };
};
