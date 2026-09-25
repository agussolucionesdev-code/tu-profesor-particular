/* Un sticker ilustrado de la marca.
 *
 * Todas las ilustraciones del sitio son DECORATIVAS: acompañan un título que ya
 * dice lo que muestran, así que van con `alt=""` —un lector de pantalla que las
 * describiera repetiría el título—. Van por ruta de `public/` y no importadas
 * (tests/imagenesServidas.test.js), con medidas declaradas para que el lugar
 * quede reservado antes de que lleguen, y diferidas: ninguna está en el primer
 * pliegue salvo que quien la monta diga lo contrario con `prioridad`.
 *
 * Fondo transparente y borde blanco de sticker: se leen igual en claro y en
 * oscuro sin variantes por tema.
 */
const Ilustracion = ({ src, className = "", lado = 480, prioridad = false }) => (
  <img
    className={`ilus ${className}`.trim()}
    src={src}
    alt=""
    width={lado}
    height={lado}
    loading={prioridad ? "eager" : "lazy"}
    decoding="async"
  />
);

export default Ilustracion;
