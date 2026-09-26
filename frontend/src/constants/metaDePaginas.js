/* TÍTULO Y DESCRIPCIÓN DE LAS PÁGINAS QUE LLEGAN PRERENDERIZADAS.
 *
 * Un solo lugar para dos lectores: la pantalla, que los aplica al navegar
 * (usePageMeta), y prerender.mjs, que los escribe en el <head> del HTML. Lo
 * del HTML es lo que ven los buscadores antes de ejecutar nada y lo ÚNICO que
 * leen WhatsApp, Facebook y compañía para armar la vista previa de un enlace.
 * Antes el HTML de /reservar traía el título y la descripción de la portada. */

export const HOST = "https://turnos.tuprofesorparticular.com.ar";

export const tituloDePagina = (titulo) => `${titulo} | Tu Profesor Particular`;

export const META_PORTADA = {
  titulo: "Reservá tu clase",
  descripcion:
    "Reservá una clase con Agustín Elías Sosa. Elegí materia, modalidad y horario, revisá el precio y confirmá tu turno online o presencial en Temperley.",
};

export const META_RESERVAR = {
  titulo: "Reservar clase",
  descripcion:
    "Reservá tu clase particular en pocos pasos. Elegí materia, modalidad y horario. Agustín Elías Sosa, Buenos Aires.",
};
