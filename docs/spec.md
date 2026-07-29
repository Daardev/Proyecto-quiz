# Spec del Proyecto: quiz-ia

## 1. Visión General
- **Nombre**: quiz-ia
- **Descripción**: Plataforma de quizzes de programación con ejecución de código en sandbox y evaluación basada en tests predefinidos
- **Plataforma**: Web
- **Arquitectura**: SSR (Server-Side Rendering) con Handlebars. El backend Express renderiza HTML completo en cada request. El cliente solo aporta interactividad (Monaco Editor, timers) via modulos JS.
- **Separación clara Backend/Frontend**: backend sirve vistas HBS renderizadas y assets estaticos. El frontend (`frontend/public/` y `frontend/src/`) contiene solo assets y modulos JS que el navegador carga.

## 2. Stack Tecnológico

### Frontend
- **Language**: JavaScript ES6+
- **Templates**: Handlebars (HBS)
- **Styling**: CSS (vanilla)
- **Componentes**: Módulos JavaScript (sin framework)
- **Comunicación**: Fetch API (llamadas al backend)

### Backend
- **Runtime**: Node.js
- **Framework**: Express + Express.Router
- **Templates**: Handlebars
- **Base de datos**: PostgreSQL + Drizzle ORM + Neon DB
- **Auth**: Google OAuth + roles (user/admin)
- **Sandbox**: Judge0 API (ejecución de código)
- **Admin dashboard**: panel web renderizado con Handlebars

## 3. Estructura del Proyecto

```
quiz-ia/
├── frontend/
│   ├── public/
│   │   └── styles/
│   │       └── main.css               # Estilos CSS vanilla
│   ├── src/
│   │   ├── components/
│   │   │   ├── code-editor.js         # Monaco wrapper module
│   │   │   ├── quiz-navigation.js     # Navegación quiz module
│   │   │   └── timer.js               # Timer con cuenta regresiva
│   │   └── lib/
│   │       └── api-client.js          # Fetch API helper
│   └── package.json

├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── questions.routes.js
│   │   │   ├── submissions.routes.js
│   │   │   ├── scores.routes.js
│   │   │   ├── admin.routes.js        # Dashboard admin
│   │   │   └── profile.routes.js      # Panel de usuario
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── questions.controller.js
│   │   │   ├── submissions.controller.js
│   │   │   ├── scores.controller.js
│   │   │   ├── admin.controller.js    # Dashboard admin
│   │   │   └── profile.controller.js  # Panel de usuario
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js     # isAuthenticated + optionalAuth
│   │   │   └── isAdmin.js            # Verifica role === 'admin'
│   │   ├── services/
│   │   │   └── sandbox.service.js
│   │   ├── views/
│   │   │   ├── layouts/
│   │   │   │   └── main.hbs
│   │   │   ├── partials/
│   │   │   │   └── navbar.hbs
│   │   │   └── pages/
│   │   │       ├── index.hbs          # Selector de quiz
│   │   │       ├── quiz.hbs           # Quiz runner
│   │   │       ├── results.hbs        # Resultados
│   │   │       ├── profile.hbs        # Panel de usuario
│   │   │       ├── dashboard.hbs      # Admin: lista de preguntas
│   │   │       └── admin/
│   │   │           └── question-form.hbs  # Admin: crear/editar
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── drizzle/
│   │   │   └── schema.js
│   │   └── app.js                     # Main entry point
│   ├── drizzle/                       # Archivos de migracion generados (salida)
│   └── package.json

└── docs/spec.md
```

## 4. Modelo de Base de Datos

El sistema modela contenido (technologies, categories, questions), usuarios y partidas (users, quizzes, quiz_questions), resultados (submissions) y sesiones (session).

```
technologies (1) ──→ (N) categories (1) ──→ (N) questions
                                                       ↑
                                                       │
users (1) ──→ (N) quizzes (1) ──→ (N) quiz_questions ──→ (N) submissions

session (independiente — guarda las sesiones HTTP de usuarios autenticados)
```

Las claves foraneas terminan en `_id` y apuntan al `id` de la tabla referenciada. El orden de creacion (resuelve dependencias) es: technologies, categories, users, questions, quizzes, quiz_questions, submissions, session.

### Tablas

**technologies** — areas grandes del quiz (JavaScript, Node.js, PostgreSQL).
```sql
technologies: id, name, icon, description
```

**categories** — sub-areas dentro de una tecnologia.
```sql
categories: id, technology_id, name, description
```

**users** — personas que se loguean con Google.
```sql
users: id, email, name, google_id, role, created_at
```

**questions** — preguntas del quiz.
```sql
questions: id, category_id, difficulty, title, description, starter_code, tests_template, is_active, hash, created_at
```

**quizzes** — una partida: 1 usuario, 1 tecnologia, N preguntas.
```sql
quizzes: id, user_id, technology_id, category_id, started_at, completed_at
```

**quiz_questions** — tabla puente: que preguntas van en que quiz y en que orden.
```sql
quiz_questions: id, quiz_id, question_id, "order"
```

**submissions** — el codigo que el usuario envio y su resultado.
```sql
submissions: id, quiz_question_id, code, sandbox_results, score, evaluated_at
```

**session** — sesiones HTTP persistidas (usada por `connect-pg-simple`). Independiente del resto.
```sql
session: sid, sess, expire
```

### Decisiones clave

- `users.role` (`'user'` | `'admin'`) — separa admins para el dashboard de Fases 13 y 14. Primer admin: `UPDATE users SET role='admin' WHERE email='tu@email.com';`
- `users.google_id` — id interno de Google; evita duplicados al loguear.
- `questions.is_active` (`boolean default true`) — soft delete usado por Fases 13 y 14.
- `questions.hash` — MD5 de title+description para deduplicar seeds.
- `quiz_questions` como tabla puente — un quiz tiene N preguntas y una pregunta puede estar en N quizzes.
- `quiz_questions.order` — persiste el orden; no se calcula al servir.
- `submissions.sandbox_results` (json) — guarda stdout, stderr, status, time, memory de Judge0.

## 5. Flujo de Usuario

```
1. Usuario selecciona: Technology → Sub-category → Difficulty (1-10 preguntas)
2. Sistema busca preguntas predefinidas en BD según selección
3. Usuario ve preguntas UNA a la vez
4. Al enviar respuesta, código se ejecuta en Judge0 (sandbox)
5. Al terminar, se muestra resultados: tests pasados/fallados + detalle
```

## 6. Categorías Específicas

### JavaScript
- DOM
- Asincronía (async/await, Promises)
- Arrays
- Variables/Scope
- Closures
- Prototypes
- ES6+
- Error Handling

### Node.js
- File System
- HTTP/Server
- Express/Middleware
- Events
- Streams
- NPM/Modules
- Environment Variables

### PostgreSQL/SQL
- Queries básicas
- JOINS
- Subqueries
- Índices
- Normalización
- Functions
- Triggers

## 7. Endpoints API

### Auth
- `GET /api/auth/google` - Login con Google
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Questions
- `POST /api/quizzes/generate` - Genera quiz completo (batch)
- `GET /api/quizzes/:id/current` - Pregunta actual
- `POST /api/quizzes/:id/submit` - Enviar respuesta (async)
- `GET /api/quizzes/:id/results` - Resultados finales

### Profile (requiere autenticación)
- `GET /profile` - Panel del usuario (vista HTML)
- `GET /api/users/me/quizzes` - Quizzes del usuario (JSON)
- `GET /api/users/me/stats` - Estadísticas del usuario (JSON)

### Admin (requiere autenticación + role admin)
Vistas (form submits):
- `GET /admin` - Dashboard con lista de preguntas
- `GET /admin/new` - Form de creación
- `GET /admin/:id/edit` - Form de edición
- `POST /admin` - Crear pregunta (form submit)
- `POST /admin/:id` - Actualizar pregunta (form submit)
- `POST /admin/:id/delete` - Soft delete (form submit)

API JSON (opcional para AJAX):
- `GET /api/admin/questions` - Listar preguntas (JSON)
- `POST /api/admin/questions` - Crear pregunta (JSON)
- `GET /api/admin/questions/:id` - Ver una pregunta (JSON)
- `PUT /api/admin/questions/:id` - Actualizar (JSON)
- `DELETE /api/admin/questions/:id` - Soft delete (JSON)

## 8. Resolución de Falencias

### Sandbox Security
- Memory limit: 256MB por ejecución
- Timeout: 10 segundos máximo
- Whitelist de librerías por tecnología

### Error Handling
- Si sandbox falla: timeout 10s → error graceful
- Queue de reintentos para submissions fallidas
- Retry con backoff exponencial (3 intentos max)

### Timeout de Quiz
- 5 minutos total por quiz
- +10 segundos por pregunta respondida
- Usuario puede saltar/regresar entre preguntas

### Sistema de Puntuación
- Score = (testsPasados / testsTotal) × 100 × dificultad
- Tests evaluados por Judge0 (sandbox)
- Sin feedback de IA

### Seguridad
- Verificación de SQL injection
- Code evalúa primero en sandbox, luego guarda seguro
- Sanitización de código enviado por usuario

## 9. Variables de Entorno

Todas las variables se cargan via dotenv desde `backend/.env` (desarrollo) o se configuran en el dashboard de Vercel (produccion). NUNCA commitear el archivo `.env` real a Git. Crear `backend/.env.example` con los mismos nombres y valores vacios.

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | Cadena de conexion a PostgreSQL (Neon). Formato: `postgresql://user:pass@host/db?sslmode=require` |
| `GOOGLE_CLIENT_ID` | Si | OAuth client ID de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Si | OAuth client secret de Google Cloud Console |
| `SESSION_SECRET` | Si | Cadena aleatoria larga. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JUDGE0_API_URL` | Si | URL base de Judge0. Self-hosted: `http://<host>:2358`. RapidAPI: `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_KEY` | Si (solo RapidAPI) | API key de Judge0. Vacio si es self-hosted |
| `NODE_ENV` | No | `development` o `production`. Default: `development` |
| `PORT` | No | Puerto del servidor. Default: `3001`. En Vercel lo asigna la plataforma |