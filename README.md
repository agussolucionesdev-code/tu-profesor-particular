# Tu Profesor Particular - Gestion de Turnos

Sistema web para reservar, consultar, reprogramar y administrar turnos de clases particulares.

## Stack

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: MongoDB + Mongoose.
- Integraciones: Google Sheets para respaldo operativo y Nodemailer/Gmail para emails.

## Flujos principales

- Reserva publica: carga datos personales y academicos, elige fecha, horario y duracion.
- Disponibilidad publica: expone solo bloques ocupados, sin nombres, telefonos, emails ni notas.
- Portal del alumno: permite consultar turnos con codigo, email o WhatsApp, reprogramar y cancelar.
- Panel admin: requiere login real con JWT y permite listar, editar estado/precio/notas, contactar por WhatsApp y limpiar datos.

## Seguridad aplicada

- Rutas admin protegidas con `Authorization: Bearer <token>`.
- `GET /api/bookings` ya no es publico.
- `GET /api/bookings/availability` reemplaza la descarga publica de reservas completas.
- Validaciones backend para contacto, fecha, duracion, horario laboral, anticipacion minima y solapamientos.
- Helmet, CORS configurable y rate limiting.
- El script `crearAdmin.js` toma usuario/clave desde variables de entorno.
- Los datos interpolados en emails se escapan antes de entrar al HTML.

## MongoDB

MongoDB sigue siendo una buena eleccion para esta etapa: el dominio es chico, los documentos de reserva son autocontenidos y Mongoose permite validar e indexar rapido. No hay una necesidad fuerte de migrar a SQL todavia.

Conviene reevaluar PostgreSQL si aparecen requerimientos como pagos contables complejos, auditoria relacional fuerte, reportes financieros multi-tabla, disponibilidad transaccional por profesor/sede o reglas de agenda muy concurrentes. Para la version actual, MongoDB es suficiente si se mantienen indices, validaciones y backups.

## Desarrollo local

1. Copiar `backend/.env.example` a `backend/.env`.
2. Configurar `MONGO_URI`, `JWT_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
   - El backend de este proyecto usa `http://localhost:4100` para no chocar con otros proyectos locales.
   - Para desarrollo sin Atlas ni Mongo local, usar `USE_MEMORY_DB=true`. Es volatil: al reiniciar el backend se borran los datos.
   - Para desarrollo local persistente, dejar `USE_MEMORY_DB=false` y usar `MONGO_URI=mongodb://127.0.0.1:27017/tu-profesor-turnos`.
3. Crear el usuario admin:

```bash
cd backend
npm install
npm run create-admin
```

4. Ejecutar backend:

```bash
npm run dev
```

5. Copiar `frontend/.env.example` a `frontend/.env` y ejecutar:

```bash
cd frontend
npm install
npm run dev
```

## Pruebas

Backend:

```bash
cd backend
npm test
```

Los tests del backend usan MongoDB en memoria, asi que no dependen de Atlas.

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Despliegue

Orden recomendado:

1. Desplegar primero el `backend`.
2. Copiar la URL publica del backend y usarla como `VITE_BACKEND_URL` en el `frontend`.
3. Desplegar el `frontend`.
4. Volver al `backend` y ajustar `CORS_ORIGIN` y `FRONTEND_URL` con la URL final del frontend.

Checklist de produccion:

- Backend con `MONGO_URI` real de Atlas y `JWT_SECRET` largo.
- `CORS_ORIGIN` y `FRONTEND_URL` apuntando al dominio final del frontend.
- `ADMIN_USERNAME` y `ADMIN_PASSWORD` definidos antes del primer arranque.
- `TRUST_PROXY=1` en hosting con proxy reverso.
- `EMAIL_USER` y `EMAIL_PASS` cargados si quieres comprobantes por mail.
- `GOOGLE_SHEET_*` cargados si quieres respaldo operativo en Sheets.
- Health check del backend respondiendo `200` en `/health`.
- Build del frontend generando correctamente y el rewrite SPA activo en `frontend/vercel.json`.

Hosting sugerido:

- `backend`: Render usando `backend/render.yaml`.
- `frontend`: Vercel usando `frontend/vercel.json`.

Si prefieres mantener un solo repositorio, ambos servicios pueden salir del mismo repo apuntando a subdirectorios distintos. Si los despliegas por separado, crea un repo para `backend` y otro para `frontend`.
