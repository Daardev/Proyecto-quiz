# Índice de Fases

> Mapa de navegación del proyecto. Las fases avanzan en orden numérico y cada una construye sobre las anteriores. Cada fila apunta al doc de la fase correspondiente (`NN-titulo.md`).
>
> **Spec canónica**: `docs/spec.md` describe la visión general del proyecto. Este índice es solo un mapa de navegación.

---

## 1. Resumen de fases

| Fase | Título | Objetivo | Output principal |
|------|--------|----------|------------------|
| 0 | Setup Inicial | Repo git, estructura raíz | `.git/`, `.gitignore`, `README.md` |
| 1 | Setup Base | Backend Express + Handlebars + ESM | `backend/src/app.js`, `backend/server.js`, estructura de carpetas |
| 2 | Configuración | Scripts npm, `.env`, `.env.example` | `package.json` con scripts, `backend/.env.example` |
| 3 | Database Schema | Tablas Drizzle + conexión Neon | 6 tablas creadas, primera migración en `backend/drizzle/` |
| 4 | Seed Data | Preguntas iniciales en BD | `backend/src/seeds/` con preguntas precargadas |
| 5 | Auth Module | Login/registro con bcrypt | `auth.service.js`, `auth.controller.js`, `auth.routes.js`, `auth.middleware.js` |
| 6 | Session Store | Sesiones en Postgres | `connect-pg-simple` integrado en `app.js` |
| 7 | CRUD Preguntas | Endpoints gestión manual preguntas | Endpoints CRUD para admin |
| 8 | Quizzes Module | Flujo generate → current → submit (con JOIN unico + SSR primera pregunta) | `generateQuiz`, `getCurrentQuestion` (con `LEFT JOIN LATERAL`, 2 queries totales), `getCurrentQuestionData` (funcion pura reutilizable para SSR), ETag/304 |
| 9 | Sandbox y Submissions | Ejecución de código en WASM | `backend/src/services/sandbox.service.js` (QuickJS + PGlite) |
| 10 | Frontend Pages | Vistas HBS + CSS | `views/pages/*.hbs`, `public/styles/main.css`, navbar partial |
| 11 | Frontend Components | Interactividad (Monaco, timer) | `frontend/src/components/`, `frontend/src/lib/api-client.js` |
| 12 | User Profile | Página `/profile` | `profile.controller.js`, `views/pages/profile.hbs` |
| 13 | Admin API | Endpoints JSON admin | `admin.routes.js`, `admin.controller.js` |
| 14 | Admin Dashboard | Vistas HBS admin | `views/pages/admin/` (lista de preguntas, form crear/editar) |
| 15 | Deploy Backend | Vercel Functions + Neon prod | `vercel.json` en `backend/` |
| 16 | Deploy Producción | Dominio + monitoring | Dominio custom, optimizaciones |

---

## 2. Mapa de temas → fases

| Tema | Fases relevantes |
|------|------------------|
| Autenticación / login / sesiones | 5 (auth) + 6 (session store) |
| Base de datos / schema | 3 (schema) + 4 (seeds) |
| Sandbox / ejecución de código | 9 (sandbox) |
| Preguntas (datos) | 4 (seeds) + 7 (CRUD) + 8 (quizzes) |
| Carga de preguntas / latencia del quiz | 8 (query unica con JOIN) + 10 (SSR primera pregunta) + 11 (atajo firstQuestion en cliente) |
| Frontend (vistas + componentes) | 10 (pages) + 11 (components) |
| Admin (API + dashboard) | 13 (API) + 14 (dashboard) |
| Deploy | 15 (basic) + 16 (producción) |
| Perfil de usuario | 12 (profile) |
| Configuración del proyecto | 0 (root) + 2 (backend scripts) |
| Bcrypt / password hashing | 5 (auth) |
| QuickJS (JavaScript sandbox) | 9 (sandbox) |
| PGlite (SQL sandbox) | 9 (sandbox) |
| Handlebars (templates) | 1 (engine) + 10 (pages) + 14 (admin views) |

---

## 3. Mapa de archivos clave

### Backend

| Archivo | Fase | Propósito |
|---------|------|-----------|
| `backend/server.js` | 1 | Entry point que arranca el servidor |
| `backend/src/app.js` | 1 | Configuración Express + Handlebars + middlewares |
| `backend/src/drizzle/schema.js` | 3 | Definición de las 6 tablas |
| `backend/src/config/database.js` | 3 | Pool de conexión a Postgres |
| `backend/src/services/auth.service.js` | 5 | Hash, verify, bootstrapAdmin |
| `backend/src/services/sandbox.service.js` | 9 | Ejecución de código en WASM |
| `backend/src/controllers/auth.controller.js` | 5 | register, login, logout, me |
| `backend/src/controllers/questions.controller.js` | 7/8 | CRUD + flujo quizzes; `getCurrentQuestionData` con `LEFT JOIN LATERAL` (2 queries totales, evita N+1) |
| `backend/src/controllers/submissions.controller.js` | 8/9 | submitAnswer, getQuizResults |
| `backend/src/controllers/admin.controller.js` | 13 | Vistas admin (form submits) |
| `backend/src/controllers/profile.controller.js` | 12 | getUserQuizzes, getUserStats |
| `backend/src/routes/auth.routes.js` | 5 | `/api/auth/*` |
| `backend/src/routes/questions.routes.js` | 7/8 | `/api/*` questions/quizzes |
| `backend/src/routes/submissions.routes.js` | 8/9 | `/api/*` submissions |
| `backend/src/routes/admin.routes.js` | 13 | `/admin/*` y `/api/admin/*` |
| `backend/src/routes/scores.routes.js` | 8 | `/api/scores` |
| `backend/src/middleware/auth.middleware.js` | 5 | isAuthenticated, isAdmin, optionalAuth |
| `backend/src/views/layouts/main.hbs` | 1 | Layout HTML base (incluye navbar inline, no como partial) |
| `backend/src/views/pages/*.hbs` | 10/12/14 | Páginas: index, login, register, quiz, results, profile, dashboard, admin/* |
| `backend/src/seeds/` | 4 | Scripts de seed de preguntas |
| `backend/drizzle.config.js` | 3 | Config de drizzle-kit (schema path, out path, DATABASE_URL) |
| `backend/drizzle/*.sql` | 3+ | Migraciones generadas por drizzle-kit |
| `backend/.env.example` | 2 | Template de variables de entorno |
| `backend/package.json` | 1/2 | Dependencias + scripts npm |
| `vercel.json` | 15 | Config deploy Vercel (lo crea Fase 15, no existe todavía) |

### Frontend

| Archivo | Fase | Propósito |
|---------|------|-----------|
| `frontend/public/styles/main.css` | 10 | Tema dark glassmorphism |
| `frontend/src/lib/api-client.js` | 11 | Cliente fetch para endpoints backend |
| `frontend/src/components/code-editor.js` | 11 | Wrapper de Monaco Editor (carga via CDN) |

---

### Carpetas auxiliares (no asociadas a fase específica)

| Carpeta | Propósito |
|---------|-----------|
| `backend/scripts/` | Scripts ad-hoc de fix/migración (debug, fix-q40, fix-q81, etc.). Uso puntual, no parte de la API |
| `backend/tests/` | Tests E2E con Playwright (`e2e-quiz.js`, `e2e-hearts-persist.js`). Agregados en Fases 4/16 según necesidad |

---

## 4. Stack progression

| Fase | Deps/Stack agregado |
|------|---------------------|
| 1 | `express`, `express-handlebars`, `nodemon` (dev), `dotenv` (dev) |
| 3 | `drizzle-orm`, `pg`, `drizzle-kit` (dev) |
| 5 | `bcrypt`, `express-session` |
| 6 | `connect-pg-simple` |
| 9 | `quickjs-emscripten`, `@electric-sql/pglite` |
| 13/14 | `playwright` (dev, tests E2E) |

### Stack final del proyecto

- **Backend**: Node.js + Express + PostgreSQL (Neon) + Drizzle ORM
- **Frontend**: Handlebars (SSR) + JavaScript ES6+ + CSS vanilla
- **Auth**: Username + Password (bcrypt) + sesiones en Postgres
- **Sandbox**: WebAssembly en proceso (QuickJS para JS/Node.js, PGlite para SQL)
- **Tests**: Playwright (E2E)
- **Deploy**: Vercel Functions

---

## 5. Convenciones del proyecto

### Cómo leer las fases

1. **En orden numérico**: cada fase asume las anteriores completas
2. **Empezar por Fase 0**: setup inicial del repo
3. **Leer Fase 1 antes de escribir código**: ahí está la estructura base
4. **Verificar el output**: cada fase tiene un `## Checklist de verificacion` que confirma el estado esperado

### Dónde está la spec canónica

- `docs/spec.md` — visión general, stack, estructura, modelo de BD, decisiones de diseño
- Cada fase tiene detalle operativo específico; la spec tiene la visión macro

### Dónde se reportan bugs

- Históricamente en `docs/00-setup-inicial.md` (sección eliminada al cierre)
- Cualquier bug nuevo debe documentarse en la fase correspondiente

### Patrón "función pura reutilizable"

Cuando un endpoint HTTP tiene una query que también necesita SSR u otro consumidor, **extrae la query a una funcion pura** que devuelve datos (no toca `req`/`res`). Ejemplos en este proyecto:

- `getCurrentQuestionData(quizId)` (Fase 8) — la consume tanto el endpoint JSON (`getCurrentQuestion`) como `GET /quiz` para SSR (Fase 10).

Regla: si en una misma fase hay mas de un consumidor para la misma query, **factoriza primero**, no dupliques.

### Regla de N+1 queries

Toda query que traiga un padre y N hijos debe resolverse en **1 sola query con JOIN**, no en bucles `for` con queries internas. Limite actual verificado:

- `GET /api/quizzes/:id/current` → **2 queries totales** (quiz + JOIN con `LEFT JOIN LATERAL`)
- Latencia objetivo < 300 ms p95 en local con seed cargado

Referencia pedagogica: Fase 8, Paso 2 ("Trampa comun: N+1 query problem").

### Stack tecnológico (no negociable)

- **No usar Google OAuth** (decidido migrar a bcrypt en algún punto del proyecto)
- **No usar Judge0** (sandbox es WASM local, sin servicios externos)
- **No usar tecnologías + categorías** (modelo simplificado: campo `language` en cada pregunta)
- **No usar `master`** (siempre `main`)

---

## 6. Glosario rápido

| Término | Significado |
|---------|-------------|
| **ESM** | ECMAScript Modules — `import`/`export` en Node.js (vs CommonJS con `require`) |
| **Drizzle ORM** | ORM TypeScript-first para SQL. Schema declarativo + migraciones generadas |
| **Neon** | Postgres serverless con branching. Usado como BD del proyecto |
| **Sandbox** | Entorno aislado para ejecutar código del usuario sin riesgos |
| **WASM** | WebAssembly. Ejecuta código binario en proceso (sin servicios externos) |
| **QuickJS** | Engine JavaScript embebido. Corre JS/Node del usuario en sandbox |
| **PGlite** | Postgres compilado a WASM. Corre SQL del usuario en sandbox |
| **Handlebars** | Motor de templates. Renderiza HTML server-side con `{{{body}}}` |
| **SSR** | Server-Side Rendering. Backend genera HTML completo, no SPA |
| **connect-pg-simple** | Store de sesiones para express-session que persiste en Postgres |
| **Monaco Editor** | Editor de código que usa VSCode (embed en navegador) |
| **Glassmorphism** | Estilo visual con blur + transparencia (usado en `main.css`) |
| **bcrypt** | Algoritmo de hash para passwords. 10 rounds en este proyecto |
| **Vercel Functions** | Serverless functions de Vercel. Cada request levanta una instancia |
| **Drizzle migration** | Archivo `.sql` generado por `drizzle-kit generate` para cambiar el schema |