import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

export default apiClient;
export { API_BASE };
