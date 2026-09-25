import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* `vite preview` con URLs limpias, como Vercel (`cleanUrls` en vercel.json).
   Vite busca `/sobre-mi` como `sobre-mi.html` y, si no está, sirve el
   index.html de la PORTADA: las pruebas de navegador del CI hidrataban la
   portada con el árbol de /sobre-mi y veían errores que en producción no
   existen (y el control del prerender miraba la portada en todas las rutas).
   Esto resuelve `/sobre-mi` → `sobre-mi/index.html`, que es lo que publica el
   prerender y lo que sirve Vercel. Sólo afecta a `vite preview`. */
const urlsLimpiasEnPreview = () => ({
  name: "urls-limpias-en-preview",
  configurePreviewServer(server) {
    const dist = path.resolve(server.config.root, server.config.build.outDir);
    server.middlewares.use((req, _res, next) => {
      const [ruta, consulta] = req.url.split("?");
      if (ruta !== "/" && !path.extname(ruta) && fs.existsSync(path.join(dist, ruta, "index.html"))) {
        req.url = `${ruta.replace(/\/$/, "")}/index.html${consulta ? `?${consulta}` : ""}`;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), urlsLimpiasEnPreview()],
  build: {
    outDir: "dist",
    sourcemap: false,
    /* El prerender lo lee para saber qué CSS lleva cada página (y lo borra
       después de usarlo: no se publica). Ver prerender.mjs. */
    manifest: true,
  },
});
