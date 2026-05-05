import { useMemo, useState } from "react";
import { loginAdmin } from "../api/bookingApi";

export const useAdminAuth = () => {
  const [authToken, setAuthToken] = useState(
    () => sessionStorage.getItem("adminToken") || "",
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(sessionStorage.getItem("adminToken")),
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const authConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${authToken}` } }),
    [authToken],
  );

  const handleLogin = async () => {
    setLoading(true);
    setAuthError("");
    try {
      const response = await loginAdmin({
        username: username.trim(),
        password: password.trim(),
      });
      if (response.data.success && response.data.token) {
        sessionStorage.setItem("adminToken", response.data.token);
        setAuthToken(response.data.token);
        setIsAuthenticated(true);
        setAuthError("");
        setPassword("");
      }
    } catch (error) {
      const status = error?.response?.status;
      setAuthError(
        status === 401 || status === 403
          ? "Credenciales incorrectas. Verificá usuario y contraseña."
          : "No se pudo conectar con el servidor. Intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminToken");
    setAuthToken("");
    setIsAuthenticated(false);
  };

  return {
    authToken,
    authConfig,
    isAuthenticated,
    username,
    password,
    loading,
    authError,
    setUsername,
    setPassword,
    handleLogin,
    handleLogout,
  };
};
