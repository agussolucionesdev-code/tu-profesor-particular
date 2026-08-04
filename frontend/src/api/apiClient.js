import axios from "axios";
import { clasificarFalla } from "./errorClassification";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD
    ? "https://tu-profesor-particular-backend.onrender.com"
    : "http://localhost:3000");

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

/* Un interceptor, un solo lugar donde se decide qué clase de falla ocurrió.
 *
 * Antes este archivo eran 16 líneas sin interceptores y cada llamada resolvía
 * sus errores como podía. El resultado más caro estaba en ManageBooking, que
 * hacía `catch { setState("invalid") }`: a quien se le cortaba el wifi la app le
 * decía que su enlace de gestión no era válido.
 *
 * El interceptor NO decide qué mostrar ni traga el error: adjunta `error.falla`
 * y lo vuelve a rechazar. Cada pantalla sigue eligiendo qué hacer —una lo
 * reintenta, otra manda a pedir un enlace nuevo—, pero todas parten del mismo
 * diagnóstico en lugar de adivinarlo de nuevo.
 *
 * A propósito NO hace reintentos automáticos: varias de estas llamadas crean o
 * cancelan turnos, y reintentar solo una operación que no es idempotente puede
 * duplicarla. Las que sí lo son ya mandan su clave de idempotencia. Reintentar
 * es decisión de quien conoce la operación, no del transporte.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error && typeof error === "object") {
      error.falla = clasificarFalla(error);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
export { API_BASE };
