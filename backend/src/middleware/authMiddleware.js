import { verifyAdminToken } from "../config/auth.js";

export const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Acceso no autorizado.",
    });
  }

  try {
    const user = verifyAdminToken(token);

    if (user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para realizar esta acción.",
        requestId: req.requestId,
      });
    }

    req.user = {
      id: user.sub,
      role: user.role,
      username: user.username,
    };
    res.setHeader("Cache-Control", "no-store");
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Sesion vencida o invalida.",
      requestId: req.requestId,
    });
  }
};
