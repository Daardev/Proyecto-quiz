# Quiz

Plataforma de quizzes de programacion con ejecucion de codigo en sandbox y evaluacion basada en tests predefinidos.

## Stack

- Backend: Node.js + Express + PostgreSQL (Drizzle ORM + Neon)
- Frontend: Handlebars + JavaScript vanilla + CSS vanilla
- Auth: Google OAuth + roles (user/admin)
- Sandbox: Judge0 (ejecucion de codigo)
- Deploy: Vercel (Functions)

## Arquitectura

SSR (Server-Side Rendering) con Handlebars. El backend Express renderiza HTML completo en cada request. El cliente solo aporta interactividad (Monaco Editor, timers) via modulos JS.

## Documentacion

Toda la documentacion del proyecto esta en `docs/`:

- `docs/spec.md` — Especificacion completa del proyecto
- `docs/00-setup-inicial.md` — Setup del repo Git
- `docs/01-setup-base.md` — Setup del backend
- `docs/02-configuracion.md` — Scripts, gitignore, .env
- `docs/03-database-schema.md` — Schema de BD con Drizzle
- `docs/04-seed-data.md` — Seeds iniciales
- `docs/05-auth-module.md` — Google OAuth + Passport
- `docs/06-session-store.md` — Sessions con connect-pg-simple
- `docs/07-crud-questions.md` — CRUD de preguntas
- `docs/08-questions-quizzes.md` — Flujo de quiz
- `docs/09-sandbox-submissions.md` — Judge0 + submissions
- `docs/10-frontend-pages.md` — Vistas HBS + CSS
- `docs/11-frontend-components.md` — Componentes JS (Monaco, timer)
- `docs/12-user-profile.md` — Panel de usuario
- `docs/13-admin-api.md` — API admin (endpoints JSON)
- `docs/14-admin-dashboard.md` — Vistas admin
- `docs/15-deploy-backend.md` — Deploy basico en Vercel
- `docs/16-deploy-production.md` — Deploy avanzado (Judge0, OAuth, dominio)

## Comandos basicos

Una vez creado el backend (Fase 01):

```bash
cd backend
npm install
npm run dev
```

Ver `docs/` para la spec completa y las fases de desarrollo en orden.