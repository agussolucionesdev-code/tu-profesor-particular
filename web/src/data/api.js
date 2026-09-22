/* La API vive en el backend de Render, que es otro origen. Su CORS ya acepta este
 * dominio desde el código —no desde una variable de entorno— justamente para que
 * el sitio no dependa de que alguien se acuerde de configurarla.
 *
 * El mismo patrón que usa la app de turnos en apiClient.js: variable de entorno
 * con fallback según el modo. Hardcodear la URL de producción dejaba el sitio
 * imposible de probar en local, que es donde se lo prueba.
 *
 * `import.meta.env` NO existe cuando este módulo corre en Node durante el
 * prerender: ahí `import.meta` está definido pero sin `env`, así que leerlo
 * directo tiraba un TypeError. React atrapaba ese error, devolvía la página vacía
 * y el build seguía sin avisar — /contacto se publicó con solo el header y el
 * footer. Por eso se lee con optional chaining.
 *
 * Vivía dentro de ContactForm.jsx. Se movió acá cuando la página de materias
 * empezó a leer los precios: dos copias de esta URL son dos lugares para que
 * uno quede apuntando a otro servidor. */
const ENV = import.meta.env ?? {};

export const API_BASE =
  ENV.VITE_BACKEND_URL ||
  (ENV.PROD
    ? "https://tu-profesor-particular-backend.onrender.com"
    : "http://localhost:4100");
