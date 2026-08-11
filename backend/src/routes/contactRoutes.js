import express from "express";
import { submitContactMessage } from "../controllers/contactController.js";
import { contactLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

/* Público y sin autenticación: es el formulario del sitio, para gente que
   todavía no reservó nada. La protección es el límite de envíos y el campo
   trampa del schema, no una credencial. */
router.post("/", contactLimiter, submitContactMessage);

export default router;
