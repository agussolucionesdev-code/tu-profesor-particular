import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signAdminToken } from "../config/auth.js";

const loginSchema = z
  .object({
    username: z.string().trim().min(3).max(160),
    password: z.string().min(8).max(128),
  })
  .strict();

export const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Por favor, proporciona el usuario y la contraseña.",
        requestId: req.requestId,
      });
    }

    const { username, password } = parsed.data;
    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas.",
        requestId: req.requestId,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas.",
        requestId: req.requestId,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      message: "Autenticacion exitosa. Bienvenido al panel.",
      token: signAdminToken(user),
      user: {
        username: user.username,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    console.error(`[Auth Error] Login failed [${req.requestId}]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor. Intentalo nuevamente.",
      requestId: req.requestId,
    });
  }
};
