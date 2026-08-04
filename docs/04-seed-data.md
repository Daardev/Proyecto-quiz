# Fase 4: Seed Data y Preguntas Iniciales

## Objetivo
Poblar la base de datos con preguntas iniciales usando el modelo simplificado (campo `language` en vez de tecnologías + categorías). Esta fase te da el primer quick win - algo visible que puedas llamar con el navegador.

---

### Paso 1: Crear seed script para preguntas

#### Como realizar el codigo

1. Abrir PowerShell en la raiz del proyecto
2. Crear el archivo (si no existe):

    ```powershell
    New-Item -ItemType File -Force -Path "backend\src\seeds\questions-batch.json"
    ```

3. Abrir con tu editor
4. Agregar preguntas siguiendo el formato del fragmento
5. Guardar

Que hacer:
Crear `src/seeds/questions-batch.json` con preguntas que tengan:
- `language` (`'javascript'` | `'sql'` | `'node'` | `'html-css-js'` | `'js-avanzado'` | `'git'`)
- `type` (`'code'` o `'multiple_choice'`)
- `title`
- `description`
- Para tipo `code`:
  - `starterCode` (string, código inicial que ve el usuario)
  - `solution` (string, texto explicativo para resultados — opcional)
  - `tests` (array de `{ input, expected }`) — formato usado actualmente
  - `solutions` (array de `{ code, tests }`, formato preferido para múltiples soluciones validas. **Actualmente NO usado por el seed**: `wipe-and-seed.js` solo popula `testsTemplate` desde `tests`. Si una pregunta tiene `solutions`, el seed no las persiste.
- Para tipo `multiple_choice`:
  - `options` (array de strings)
  - `correctOption` (índice 0-based)
  - `solution` (string, texto explicativo para resultados)
- (NO `difficulty`, NO `category`, NO `category_id`, NO `technology_id`)

Pistas:
- El JSON se lee desde el script `wipe-and-seed.js` y se inserta en BD
- Cada pregunta genera un hash MD5 de `title+description` para deduplicación
- En tiempo de ejecucion, `submissions.controller.js` (L99) prioriza `solutions` si existe: si `solutions` es array no-vacio, usa `runAgainstSolutions()`. Si no, fallback a `testsTemplate` (de `tests`). Ver `sandbox.service.js:runAgainstSolutions`.
- `solution` (singular) es texto legible: para MC explica por que la respuesta correcta es la correcta; para codigo se muestra en la pantalla de resultados.
- **Estado actual del seed**: `wipe-and-seed.js` solo popula `testsTemplate` desde `tests`. Las 112 preguntas actuales usan `tests`. La columna `solutions` en BD queda null.

Que estudiar:
- Estructura de datos para preguntas de programacion
- Como diseñar testsTemplate: input vs expected vs description
- Multiplicidad de soluciones válidas: cuando aplica (orden de parámetros, alias de funciones, sintaxis equivalente)

---

### Paso 2: Crear seed script ejecutable

#### Como realizar el codigo

1. Abrir PowerShell en `backend/`
2. Crear el archivo (si no existe):

    ```powershell
    New-Item -ItemType File -Force -Path "backend\src\seeds\wipe-and-seed.js"
    ```

3. Abrir con tu editor
4. Implementar las funciones del fragmento clave
5. Guardar

Que hacer:
Crear `src/seeds/wipe-and-seed.js` que:
1. Borre tablas obsoletas (categories, technologies) — idempotente con `DROP TABLE IF EXISTS` (ver Fase 3 Paso 8)
2. Borre columnas obsoletas (questions.difficulty, questions.category_id, quizzes.technology_id, quizzes.category_id) — idempotente con `DROP COLUMN IF EXISTS`
3. Agregue `questions.solution` (TEXT) si no existe — idempotente con `ADD COLUMN IF NOT EXISTS`. Las migraciones Drizzle (Fase 03) crean la columna `questions.solutions` (JSON) — este script no la popula desde el JSON (queda null).
4. Agregue `language` a `questions` y `quizzes` si no existen
5. Trunque todas las tablas de quiz data (submissions, quiz_questions, quizzes, questions)
6. Lea `questions-batch.json`
7. Inserte cada pregunta con `hash` calculado

Pistas:
- El script maneja la migración del esquema en el mismo paso que el seed (ver Fase 3 Paso 8: DDL no-Drizzle).
- Idempotente: se puede correr múltiples veces sin errores.
- Las preguntas `code` con `language='sql'` se ejecutan con PGlite; las `language='node'` o `language='js-avanzado'` con QuickJS-WASM; las `language='html-css-js'` con el evaluador de markup por regex. **Las preguntas con `language='git'` no son de codigo** (son multiple_choice).
- El campo `tests` se persiste como JSON en `testsTemplate`. La columna `solutions` (plural) del schema existe pero actualmente `wipe-and-seed.js` no la popula desde el JSON.
- El script NO crea la columna `attempts_left` en `quizzes` ni `kind` en `submissions` ni `attempts_count` en `quiz_questions` — esas vienen de migraciones Drizzle (`0002`, `0003`) que se ejecutan antes (Fase 3 Paso 7).

Que estudiar:
- Drizzle: `db.insert(questions).values(...)`, `db.execute(sql\`...\`)`
- SQL: `DROP TABLE IF EXISTS`, `ALTER TABLE ADD/DROP COLUMN IF [NOT] EXISTS`
- Truncar en CASCADE: `TRUNCATE submissions, quiz_questions, quizzes, questions RESTART IDENTITY CASCADE` reinicia los IDs y respeta FKs

---

### Paso 3: Ejecutar seed completo

Que hacer:
1. El script `seed` ya está en `package.json` apuntando a `wipe-and-seed.js`:
   - `seed`: `node src/seeds/wipe-and-seed.js`
2. Ejecutar `npm run seed`
3. Verificar en BD que las tablas tienen datos

Pistas:
- El script corre migraciones de esquema + inserta preguntas en una pasada
- Si falla por connection refused la BD no está corriendo o la URL es incorrecta
- Si falla por `relation does not exist` las migraciones de Drizzle no se aplicaron (correr `npm run db:migrate` antes)
- Si falla por `column "solution" does not exist` la migración `ALTER TABLE` no se ejecutó (revisar Paso 2)

Que estudiar:
- Neon Console - interfaz web para ver datos
- SELECT basico en PostgreSQL: count where join
- Como debuggear errores de conexion y migraciones

---

### Paso 4: Verificar archivos de soporte

Que hacer:
Revisar que `backend/.env.example` solo contenga variables (`CLAVE=valor`), no código JS. Si ves algo como `import 'dotenv/config';` en alguna linea (error historico de cuando el archivo se regeneraba desde `.env`), borralo.

Contenido esperado de `backend/.env.example`:
```
DATABASE_URL=
SESSION_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_EMAIL=
NODE_ENV=development
PORT=3001
```

Pistas:
- Un archivo `.env` solo contiene `CLAVE=valor`, una por línea. No tiene `import`, no tiene comillas obligatorias, no tiene punto y coma.
- `dotenv` no necesita que se importe en `.env` — se importa en el codigo JS (`server.js`, `app.js`).

Que estudiar:
- Formato de archivos `.env` (formato `dotenv`, no `ini`)
- Por que `.env.example` se commitea pero `.env` no

---

### Checklist de verificacion

- [ ] `questions-batch.json` con preguntas que tengan `language`, `type`, `title`, `description` y campos específicos según tipo
- [ ] Preguntas `code` usan `tests` (unico formato actual). `solutions` es parte del schema pero no se popula desde el seed
- [ ] Preguntas `multiple_choice` tienen `options`, `correctOption` y `solution` (texto)
- [ ] `wipe-and-seed.js` ejecuta limpieza + migración + seed sin errores
- [ ] `npm run seed` funciona correctamente
- [ ] Datos visibles en Neon Console: `SELECT COUNT(*) FROM questions;`
- [ ] Distribución por lenguaje: `SELECT language, COUNT(*) FROM questions GROUP BY language;`
- [ ] (Alternativa local) `node src/seeds/verify-db.js` para ver desglose por language/type
- [ ] `backend/.env.example` no contiene código JS (revisar primera línea)
- [ ] `src/seeds/seed.js` y `src/seeds/questions.seed.js` borrados (legacy)

---

## Que viene en Fase 5

Las tablas `users` y `session` existen pero estan vacias. En **Fase 5 (Auth Module)** se implementa:
- `src/services/auth.service.js` con `hashPassword`, `verifyPassword`, `bootstrapAdmin`
- `src/controllers/auth.controller.js` con `register`, `login`, `logout`, `me`
- `src/routes/auth.routes.js` con `/api/auth/*`
- `src/middleware/auth.middleware.js` con `isAuthenticated`, `isAdmin`

**Al ejecutar `npm run dev`**, `bootstrapAdmin()` se llama automaticamente desde `app.js`:
- Si `ADMIN_USERNAME` y `ADMIN_PASSWORD` estan en `.env`, crea el usuario admin o lo promueve a `role='admin'`
- Si no estan, no hace nada (no falla)

**Bridge de inputs/outputs:**

| De Fase 04 | A Fase 05 |
|------------|-----------|
| `users` y `session` tablas creadas | Fase 05 inserta primer admin via `bootstrapAdmin()` |
| `ADMIN_USERNAME`/`ADMIN_PASSWORD` en `.env` | Se usan en `bootstrapAdmin()` |
| Schema con todas las columnas de `users` | `bcrypt` + `express-session` se instalan |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Seed data | Poblacion inicial de datos para desarrollo |
| Hash MD5 | Deduplicar preguntas por contenido (title+description) |
| Idempotencia | El script debe poder ejecutarse multiples veces sin errores |
| Diseno de tests | Tests claros y simples para evaluar codigo |
| Migraciones idempotentes | DROP IF EXISTS, ADD COLUMN IF NOT EXISTS permiten correr el script varias veces |
| Multiples soluciones validas | `solutions` (plural) permite aceptar respuestas equivalentes |
