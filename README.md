# FEMIC Maquinaria - Panel interno

Panel interno de FEMIC Maquinaria (renta de maquinaria con operadores).

Este repositorio esta organizado como monorepo con dos proyectos separados:

- `frontend/`: app React + Vite
- `backend/`: API Express + Prisma

## Recomendacion para Vercel

Despliega `frontend` y `backend` como dos proyectos distintos en Vercel usando la misma rama o repositorio.

### 1. Backend

- Crea un proyecto nuevo en Vercel con `Root Directory = backend`
- Configura estas variables de entorno:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `FRONTEND_URL`
  - `EMAIL_HOST`
  - `EMAIL_PORT`
  - `EMAIL_USER`
  - `EMAIL_PASS`
  - `EMAIL_FROM`
  - `CORREO_USUARIO`
  - `CORREO_PASSWORD`
- Usa como referencia `backend/.env.example`

La API quedara disponible en rutas como:

```text
https://tu-backend.vercel.app/api/health
```

### 2. Frontend

- Crea otro proyecto en Vercel con `Root Directory = frontend`
- Configura:
  - `VITE_API_URL=https://tu-backend.vercel.app/api`
- Usa como referencia `frontend/.env.example`

## Nota importante sobre archivos

El backend actual usa almacenamiento local en `backend/uploads` para algunos adjuntos. En Vercel el sistema de archivos no es persistente, asi que:

- el deploy funcionara para la app y la API
- la carga de archivos local no es una solucion durable en produccion
- para produccion conviene mover adjuntos a Supabase Storage, S3 o Vercel Blob

## Ajuste incluido en este repo

Se actualizo `frontend/vercel.json` para que el rewrite de SPA no capture rutas `/api`.
