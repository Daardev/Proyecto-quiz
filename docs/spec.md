# Spec del Proyecto: Quiz

## 1. Visión General
- **Nombre**: Quiz
- **Descripción**: Plataforma de quizzes de programación con ejecución de código en sandbox y evaluación basada en tests predefinidos. Modelo simplificado: preguntas agrupadas por **lenguaje** (sin jerarquía de tecnologías ni niveles de dificultad).
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
- **Auth**: Username + Password (bcrypt) + sesiones propias + roles (user/admin)
- **Sandbox**: WebAssembly en proceso (QuickJS para JavaScript/Node.js, PGlite para PostgreSQL/SQL)
- **Admin dashboard**: panel web renderizado con Handlebars

## 3. Estructura del Proyecto

```
Quiz/
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
│   │   │   ├── admin.controller.js
│   │   │   └── profile.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js     # isAuthenticated + isAdmin + optionalAuth
│   │   ├── services/
│   │   │   ├── auth.service.js        # hashPassword, verifyPassword, bootstrapAdmin
│   │   │   └── sandbox.service.js     # Ejecuta codigo en QuickJS/PGlite
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

**Diseño simplificado**: las preguntas tienen un campo `language` (`'javascript'` | `'sql'`) en lugar de la jerarquía `technology > category`. No hay niveles de dificultad.

```
users (1) ──→ (N) quizzes (1) ──→ (N) quiz_questions ──→ (N) submissions
                                          ↓
                                       (1) questions

session (independiente — guarda las sesiones HTTP de usuarios autenticados)
```

Las claves foraneas terminan en `_id` y apuntan al `id` de la tabla referenciada.

### Tablas

**users** — personas que se registran con username + password.
```sql
users: id, username, email, name, password_hash, role, created_at
```

**questions** — preguntas del quiz, agrupadas por lenguaje.
```sql
questions: id, language, type, title, description, starter_code,
           tests_template, options, correct_option, solution, solutions,
           is_active, hash, created_at
```

**quizzes** — una partida: 1 usuario, 1 lenguaje, N preguntas.
```sql
quizzes: id, user_id, language, started_at, completed_at, attempts_left
```

**quiz_questions** — tabla puente: que preguntas van en que quiz y en que orden.
```sql
quiz_questions: id, quiz_id, question_id, "order", attempts_count
```

**submissions** — el codigo que el usuario envio y su resultado.
```sql
submissions: id, quiz_question_id, code, sandbox_results, score, evaluated_at, kind
```

**session** — sesiones HTTP persistidas (usada por `connect-pg-simple`). Independiente del resto.
```sql
session: sid, sess, expire
```

### Decisiones clave

- `users.username` y `users.email` son únicos. `username` se usa para login; `email` para contacto.
- `users.password_hash` almacena el hash bcrypt (10 rounds). Nunca se guarda el password en texto plano.
- `users.role` (`'user'` | `'admin'`) — separa admins para el dashboard. Primer admin se crea via variables de entorno `ADMIN_USERNAME`/`ADMIN_PASSWORD`.
- `questions.language` (`'javascript'` | `'sql'` | `'node'` | `'html-css-js'` | `'js-avanzado'` | `'git'`) — identifica el lenguaje de la pregunta. Sin categorías ni sub-categorías. Ver §6 para la lista completa y cómo se ejecuta cada uno.
- `questions.type` (`'code'` | `'multiple_choice'`) — código para ejecutar o selección múltiple.
- `questions.solution` (text, nullable) — solución/resolución en texto plano. Se usa para preguntas `multiple_choice` (explica por qué la opción correcta es la correcta) y como fallback en la pantalla de resultados.
- `questions.solutions` (json, nullable) — array de soluciones candidatas para preguntas `code`. Cada elemento es `{ code, tests }`. El sandbox ejecuta el código del usuario contra los `tests` de **cada** solución; la pregunta se considera correcta si **alguna** de las soluciones pasa todos sus tests. Esto permite múltiples respuestas válidas (ej: orden de parámetros irrelevante, funciones equivalentes).
- `questions.is_active` (`boolean default true`) — soft delete.
- `questions.hash` — MD5 de title+description para deduplicar seeds.
- `quiz_questions` como tabla puente — un quiz tiene N preguntas y una pregunta puede estar en N quizzes.
- `quiz_questions.order` — persiste el orden; no se calcula al servir.
- `quiz_questions.attempts_count` (`int default 0`) — contador de envíos del usuario para esta pregunta en este quiz. No consume vidas del quiz; es solo métrica.
- `submissions.sandbox_results` (json) — guarda stdout, stderr, status, time, memory del sandbox WASM. Incluye un flag interno `_isCorrect` que el frontend consume para mostrar feedback (check/error animación).
- `submissions.kind` (`varchar(20) default 'answer'`) — distingue envíos reales (`'answer'`) de saltos (`'skipped'`). Una pregunta con `kind='skipped'` cuenta como resuelta para avanzar el quiz.
- `quizzes.attempts_left` (`int default 5`) — vidas del quiz (corazones en UI). Se decrementa solo en envíos **incorrectos** (`submitAnswer` cuando `isCorrect=false` o `skipQuestion`). Las respuestas correctas no consumen vida. Cuando llega a 0, el quiz termina y redirige a `/results`.

## 5. Flujo de Usuario

```
1. Usuario se registra/inicia sesión (username + password)
2. Usuario selecciona: Lenguaje + Cantidad de preguntas (1-20)
3. Sistema busca preguntas predefinidas según el lenguaje elegido
4. Usuario ve preguntas UNA a la vez
5. Al enviar respuesta, código se ejecuta en sandbox WASM (QuickJS o PGlite)
   o se compara índice de selección múltiple
6. Al terminar, se muestra resultados: tests pasados/fallados + score total
```

## 6. Lenguajes soportados

El modelo es **plano por lenguaje** (sin jerarquía de tecnologías ni niveles de dificultad). Cada `language` decide cómo se ejecuta el código en el sandbox. El campo se persiste en `questions.language` y `quizzes.language`.

| Valor `language` | Sandbox | Categoría interna | Uso típico |
|---|---|---|---|
| `javascript` | QuickJS-WASM | `javascript` | Algoritmos, arrays, strings, closures, ES6+ |
| `sql` | PGlite (in-process) | `postgresql` | DDL, DML, joins, subqueries, transacciones |
| `node` | QuickJS-WASM | `javascript` | JWT, REST, Express, MVC, middleware, file system |
| `js-avanzado` | QuickJS-WASM | `javascript` | Clases, async/await avanzado, prototypes |
| `html-css-js` | Regex matcher (evaluador de markup) | `html-css-js` | Validación de HTML/CSS estático por regex |
| `git` | (sin sandbox) | — | Selección múltiple (no hay código a ejecutar) |

### Temas por lenguaje

#### JavaScript
- Arrays (sum, filter, reverse, unique)
- Strings (capitalize, countVowels, reverse)
- Asincronía (Promise, async/await, chainValues)
- ES6+ (destructuring, spread)
- Closures (makeCounter)

#### Node
- JWT (ataques, storage, validación)
- REST API (validación, versionado, status codes)
- Sequelize ORM
- Renderizado (EJS, Handlebars)
- MVC
- Express/Middleware
- File System

#### SQL
- Modelo ER
- SQL DDL (CREATE, ALTER, RENAME)
- SQL DML (UPDATE, DELETE con WHERE)
- SQL Transacciones (BEGIN/COMMIT)
- Queries básicas (SELECT, WHERE, GROUP BY, HAVING)
- JOINS (INNER, LEFT, con COUNT)
- Subqueries (WITH, INSERT...SELECT)
- Agregación (GROUP BY, SUM, COUNT)

#### HTML/CSS/JS
- Estructura HTML (`hasElement`, `elementText`)
- Estilos inline (`hasStyle`)
- Atributos (`hasAttribute`)
- Clases e IDs (`hasClass`, `hasId`)

#### JS Avanzado
- Clases (extends, super)
- Async/await avanzado
- Manejo de errores (try/catch)

#### Git
- Comandos básicos (add, commit, push)
- Ramas (branch, merge, rebase)
- Resolución de conflictos

## 7. Endpoints API

### Auth
- `POST /api/auth/register` - Registro con `{ username, email, name?, password }`
- `POST /api/auth/login` - Login con `{ username, password }`
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Questions
- `GET /api/languages` - Lista de lenguajes disponibles: `['javascript', 'sql']`
- `POST /api/quizzes/generate` - Genera quiz completo con `{ language, count }`
- `GET /api/quizzes/:id/current` - Pregunta actual
- `POST /api/quizzes/:id/submit` - Enviar respuesta (síncrono, sandbox WASM o MC). Upsert: si ya hay submission previa, se reemplaza.
- `POST /api/quizzes/:id/skip` - Saltar pregunta (solo si la pregunta ya fue respondida mal alguna vez). Consume 1 vida adicional y marca la submission como `kind='skipped'`.
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

## 8. Resolución de Falencias

### Sandbox Security
- Aislamiento nativo via WebAssembly (memory-safe, sin acceso al sistema)
- Sin polling (ejecución síncrona, en proceso)
- Sandbox seguro por diseño (WASM)

### Error Handling
- Si el sandbox falla: error capturado en try/catch, score 0
- Sin cola de reintentos (ejecución síncrona)
- Resultados siempre devueltos

### Intentos de Quiz
- 5 intentos totales por quiz (se muestran como corazones en la UI)
- Las respuestas correctas **no consumen** intento
- Cada envío de respuesta **incorrecta** consume 1 intento
- **Sin botón Saltar**: la única forma de avanzar tras un fallo es corregir la respuesta (múltiples envíos son válidos mientras queden vidas)
- Una misma pregunta puede responderse varias veces: el backend hace upsert de la `submission` (último envío gana); `quiz_questions.attempts_count` lleva el conteo de envíos
- Cuando los intentos llegan a 0 el quiz termina automáticamente y redirige a `/results`
- No hay timeout por tiempo: la duración del quiz depende solo de cuántos intentos gaste el usuario
- **Sin feedback intermedio durante el quiz**:
  - Tras acierto: animación de check (✓ verde, `checkPop`) por ~850ms + auto-avance a la siguiente pregunta
  - Tras fallo: animación de error (✗ rojo con shake, `errorShake`) por ~550ms + rehabilitación del botón submit para reintentar
  - El score, los detalles de tests y la respuesta correcta solo se muestran en `/results` al finalizar

### Sistema de Puntuación
- Score por pregunta = `(testsPasados / testsTotales) × 100`
- **Máximo 100 puntos por pregunta** (sin multiplicador de dificultad)
- Score total del quiz = suma de scores de cada pregunta

### Seguridad
- Passwords hasheados con bcrypt (10 rounds)
- Sesiones con cookie httpOnly
- Validación de inputs (regex username, formato email, longitud password)
- Sanitización de respuestas (password_hash nunca se expone)

## 9. Variables de Entorno

Todas las variables se cargan via dotenv desde `backend/.env` (desarrollo) o se configuran en el dashboard de Vercel (producción). NUNCA commitear el archivo `.env` real a Git. Crear `backend/.env.example` con los mismos nombres y valores vacios.

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | Cadena de conexion a PostgreSQL (Neon). Formato: `postgresql://user:pass@host/db?sslmode=require` |
| `SESSION_SECRET` | Si | Cadena aleatoria larga para firmar cookies. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_USERNAME` | No | Username del admin creado automáticamente al iniciar el server |
| `ADMIN_PASSWORD` | No | Password del admin creado automáticamente al iniciar el server |
| `ADMIN_EMAIL` | No | Email del admin (default: `${ADMIN_USERNAME}@admin.local`) |
| `NODE_ENV` | No | `development` o `production`. Default: `development` |
| `PORT` | No | Puerto del servidor. Default: `3001`. En Vercel lo asigna la plataforma |
