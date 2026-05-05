# Tu Profesor Particular - Backend

API REST para reservas, portal del alumno y panel administrativo.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticacion admin
- Google Sheets opcional para respaldo operativo
- Nodemailer/Gmail opcional para emails

## Estado actual

- La persistencia real del proyecto es `MongoDB + Mongoose`.
- No hay Prisma configurado en este backend.
- `/health` informa si la conexion esta operativa y si la base actual es persistente o efimera.

## Scripts

```bash
npm install
npm run dev
npm test
npm run create-admin
```

## Variables de entorno

Tomar como base `backend/.env.example`.

Obligatorias para produccion:

- `MONGO_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Opcionales:

- `FRONTEND_URL`
- `ALLOW_INSECURE_JWT_SECRET`
- `AUTH_RATE_LIMIT_MAX`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TITLE`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `MAX_AVAILABILITY_RANGE_DAYS`
- `MONGO_DIRECT_URI`
- `MONGO_FALLBACK_TO_MEMORY`
- `MONGO_MAX_POOL_SIZE`
- `MONGO_MIN_POOL_SIZE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `OWNER_NOTIFICATION_EMAIL`
- `PUBLIC_LOOKUP_RATE_LIMIT_MAX`
- `PUBLIC_MUTATION_RATE_LIMIT_MAX`
- `SERVER_REQUEST_TIMEOUT_MS`
- `SERVER_HEADERS_TIMEOUT_MS`
- `SERVER_KEEP_ALIVE_TIMEOUT_MS`

Notas:

- `TRUST_PROXY=1` deja Express listo para Render u otro proxy.
- `/health` devuelve `503` si MongoDB no esta conectado.
- Si Atlas falla con `querySrv ECONNREFUSED`, el problema suele ser DNS local bloqueando la URI `mongodb+srv://...`. En ese caso, usa `MONGO_DIRECT_URI` con una URI `mongodb://...` no-SRV de Atlas o deja `MONGO_FALLBACK_TO_MEMORY=true` solo para desarrollo.
- `MONGO_FALLBACK_TO_MEMORY` debe quedar en `false` en produccion. En desarrollo evita que `npm run dev` se caiga cuando Atlas o el DNS local no estan disponibles, pero los datos son efimeros.
- Las rutas publicas y de login tienen rate limiting dedicado para reducir brute force y scraping.
- Los endpoints sensibles devuelven `Cache-Control: no-store` y `X-Request-Id` para trazabilidad.
- Si no configuras Google Sheets o Gmail, la API sigue funcionando.
- En desarrollo, la API acepta `localhost` y `127.0.0.1` en cualquier puerto para evitar bloqueos de CORS con Vite u otros servers locales.

## Despliegue recomendado

1. Crear un cluster en MongoDB Atlas y copiar la URI `mongodb+srv://...`.
2. Agregar en Atlas una IP Access List compatible con el hosting de la API.
3. Crear un repo GitHub solo para esta carpeta `backend`.
4. En Render crear un `Web Service` conectado a ese repo.
5. Usar:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
6. Cargar las variables de entorno del `.env.example`.
7. Verificar que `MONGO_FALLBACK_TO_MEMORY=false` en ambientes donde necesitas persistencia real.
8. Configurar `CORS_ORIGIN` con la URL final del frontend.

Archivo incluido:

- `render.yaml`: deja listo runtime, health check y variables esperadas para Render Blueprint.
# Tu-Profesor-Particular-Gestion-Turnos-Backend
# Tu-Profesor-Particular-Gestion-Turnos-Backend
