# Tu Profesor Particular - Frontend

SPA publica y panel administrativo para gestionar turnos.

## Stack

- React 19
- Vite 7
- React Router
- Axios
- date-fns

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Variables de entorno

Tomar como base `frontend/.env.example`.

```bash
VITE_BACKEND_URL=https://tu-backend.example.com
```

Solo las variables que empiezan con `VITE_` quedan expuestas al frontend.

## Rutas de la app

- `/` y `/reservar`: formulario de reserva
- `/portal`: portal del alumno
- `/admin`: panel administrativo

## Despliegue recomendado

1. Crear un repo GitHub solo para esta carpeta `frontend`.
2. Importarlo en Vercel como proyecto Vite.
3. Definir `VITE_BACKEND_URL` con la URL publica del backend.
4. Desplegar.

Archivo incluido:

- `vercel.json`: hace rewrite de SPA para que `/admin` y `/portal` no fallen al refrescar.
# Tu-Profesor-Particular-Gestion-Turnos-Frontend
