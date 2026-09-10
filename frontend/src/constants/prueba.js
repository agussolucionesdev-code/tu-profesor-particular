/* Testimonios, en la app de turnos.
 *
 * ESPEJO PARCIAL de `web/src/data/prueba.js`: de allá se replica sólo la lista de
 * testimonios y sus reglas, porque es lo único que los dos dominios tienen que
 * publicar igual. Los hechos verificables y la nota se quedan en el institucional
 * —ahí es donde alguien evalúa; acá ya decidió y está reservando—.
 *
 * `web/tests/pruebaCompartida.test.js` compara los dos archivos. Si alguien publica
 * un testimonio en un sitio y no en el otro, o lo edita en uno solo, ese test falla y
 * el deploy se frena.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE ESTANDO VACÍO
 *
 * Porque el día que llegue el primer testimonio, el trabajo de decidir dónde va, con
 * qué reglas y con qué verificación ya está hecho. Si no existiera, ese día alguien
 * lo pega a mano en un JSX —sin permiso registrado, sin test, y en un solo dominio—,
 * que es exactamente el modo de falla que este archivo viene a evitar.
 *
 * REGLA, la misma que en el otro archivo: el texto va TAL CUAL lo escribió la
 * persona, y no entra sin permiso registrado.
 */

/* Las reglas completas —los cinco requisitos para agregar uno— están en
   `web/src/data/prueba.js`. No se duplican acá a propósito: dos copias de una regla
   se desincronizan, y la que manda es la del archivo que tiene el test al lado.

   Lo que sí se repite, porque es lo que más se olvida: `permiso` es OBLIGATORIO, y
   autorizar el texto NO es autorizar el nombre. */
export const TESTIMONIOS = [];

export const hayTestimonios = () => TESTIMONIOS.length > 0;
