import express from "express";
import {
  getCandidatosAResena,
  getStudentById,
  getStudents,
  updatePedidoDeResena,
} from "../controllers/studentController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireAdmin);
router.get("/", getStudents);

/* ANTES que `/:id`, y no es cosmético: Express resuelve por orden, así que con
   `/:id` declarado primero una llamada a `/candidatos-resena` entraría a
   `getStudentById` con id="candidatos-resena" y devolvería un 400 de
   "identificador inválido" — un error que manda a buscar el problema al lugar
   equivocado. */
router.get("/candidatos-resena", getCandidatosAResena);

router.get("/:id", getStudentById);
router.patch("/:id/pedido-resena", updatePedidoDeResena);

export default router;
