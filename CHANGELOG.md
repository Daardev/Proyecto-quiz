# Changelog

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.2.0] - 2026-08-05

### Added
- Layout de dos paneles para preguntas de código (`type === 'code'`): panel izquierdo read-only con enunciado y `starterCode`, panel derecho editable donde el usuario escribe su respuesta.
- Botón **Probar código** que ejecuta el código del usuario en el sandbox sin contar como intento ni comparar contra tests. La salida se renderiza en una **consola** debajo del editor (tabla para SQL, JSON para JS, mensaje neutro para markup).
- Nuevo endpoint `POST /api/quizzes/:quizId/preview` que devuelve la salida cruda o el error.
- Nuevas funciones en `sandbox.service.js`: `runPreview`, `previewPostgres`, `previewJavaScript`, `previewMarkup`.
- Soporte para preguntas de código en **Node.js** (comparten el runtime QuickJS con `js-avanzado`): tests file `backend/src/seeds/tests/node.json`, schema `node.test.schema.json`, pregunta de ejemplo "String más largo de un array".
- Soporte para **múltiples soluciones** por pregunta de código: el usuario pasa si su código pasa los tests de cualquier solución. El form admin ahora permite agregar/quitar soluciones y la vista de resultados muestra cada solución en `<details>` colapsable.
- Botón **Probar esta pregunta** en el form admin que crea un quiz efímero de 1 pregunta y abre el quiz runner en una pestaña nueva.
- Campos `editorStarterCode` (código inicial del panel editable) y `setupCode` (código previo, no visible, ej: CREATE TABLE / helpers) en el form admin.
- Columna `editor_starter_code` en la tabla `questions` (migración `0004_questions_editor_starter_code`).
- Contador `previews_used` por `quiz_question` (límite 10 previews por pregunta).
- Vista índice ampliada: carrusel de tarjetas de lenguaje con autoplay, gradientes por tecnología, tags semánticos y contador de preguntas.
- Sidebar de navegación en `quiz.hbs` con iconos de estado (○ pendiente / ● respondida / ⤴ salteada) y persistencia en `localStorage`.
- Servicio `backend/src/services/question-export.js` que sincroniza `tests/<lang>.json` desde la BD cuando se crea/edita/borra una pregunta.
- Tests E2E reescritos (`e2e-quiz-new-flow.mjs`, `test-finish-flow.mjs`); los antiguos movidos a `backend/tests/legacy/`.

### Changed
- `CodeEditor` acepta opción `readOnly` para crear visores no editables (usado en el panel izquierdo).
- `toQuestionPayload` (`questions.controller.js`) incluye `setupCode`, `editorStarterCode` y `solutions` en el payload.
- `quiz.hbs` separa su layout por `type`:
  - `code`: dos paneles + caja "Resultado" siempre visible (placeholder hasta ejecutar `Probar código`) + dos botones (`Probar código`, `Saltar`).
  - `multiple_choice`: layout original sin cambios.
- `dashboard.hbs` calcula `hasSolution` desde `solution` legacy **y** `solutions[]` nuevo.
- Consola de `quiz.hbs` ahora muestra **"Test aprobado" / "Test no aprobado"** en vez del contador `X/N tests pasaron` (más legible).
- Bloque "Tu código" en `results.hbs` colapsado dentro de `<details>`; el footer con Score/Tests se reemplaza por un indicador simple **"Test aprobado" / "Test no aprobado"**; el bloque de respuesta correcta se omite (ahora se ve solo lo que el usuario respondió).
- `submissions.controller.js` reescrito: un sólo `POST /api/quizzes/:quizId/finish` reemplaza a `submit`/`skip` separados y maneja multi-solución con `runAgainstSolutions`.
- `wipe-and-seed.js` reescrito: lee preguntas activas de la BD, regenera `tests/<lang>.json`, archiva las preguntas huérfanas (`archivedAt`) y toma un snapshot (`seed-helpers.js`) antes de tocar nada.
- `main.css` agrega estilos para `.question-grid`, `.question-panel`, `.console-output`, `button.btn-danger`, `#preview-btn.is-busy`, carrusel y sidebar de preguntas.
- `package.json`: scripts `test:e2e` apunta al nuevo flujo y se agrega `test:flow`. `nodemonConfig` ignora `src/seeds/tests/**`.
- `.gitignore` añade `/backups/` (raíz) y `backend/audit-states.mjs`, `backend/check-admin.mjs`.
- Snapshot `0004_snapshot.json` regenerado a partir de `schema.js` para reflejar el estado real de la BD (incluye `setup_code`, `archived_at`, `previews_used` que estaban agregadas por `migrateSchema()`).

### Removed
- `backend/src/seeds/questions-batch.json` (5 172 líneas) — reemplazado por el seed que lee de la BD.
- Scripts one-off de seeds (`check-js.js`, `cleanup-anonymous.js`, `cleanup-categories.js`, `debug-regex.js`, `migrate-solutions.js`, `seed-merged.js`, `smoke-test.js`, `test-button.js`, `test-js.js`, `test-sql.js`, `verify-db.js`).
- `backend/src/services/questions-json-sync.js` — reemplazado por `question-export.js`.
- Tests E2E antiguos (`e2e-admin-preview.mjs`, `e2e-hearts-persist.js`, `e2e-q65-ui-flow.mjs`, `e2e-q67-ui-flow.mjs`, `e2e-q68-ui-flow.mjs`, `e2e-quiz-advance-bug.mjs`, `e2e-quiz-hearts.mjs`, `e2e-quiz.js`) — movidos a `backend/tests/legacy/`.

### Migration notes
- Las migraciones existentes (0000–0003) no incluyen `setup_code`, `archived_at`, `previews_used` (se agregaron vía `migrateSchema()` en `wipe-and-seed.js`). El snapshot 0004 ya las refleja para que `drizzle-kit generate` no sugiera columnas duplicadas.
- En Vercel, `vercel-build` ejecuta `drizzle-kit migrate` (que solo agrega `editor_starter_code` si no existe). No se ejecuta `npm run seed` automáticamente.
- `npm run seed` toma un snapshot JSON en `backups/` antes de tocar la BD (excluido del repo por `.gitignore`).

## [v0.1.0] - 2026-08-03

### Added
- Backend Node.js + Express con autenticación por sesión, módulo de preguntas, quizzes, sandbox de submissions y panel admin.
- Migraciones Drizzle para esquema de base de datos (usuarios, preguntas, quizzes, intentos, submissions, scores).
- Seed inicial de preguntas sintéticas en `backend/src/seeds/questions-batch.json`.
- Frontend con páginas de login, dashboard, quiz, resultados y perfil.
- Suite de pruebas E2E con Playwright para flujos logueado y anónimo.
- Documentación por fases (`docs/00-*` a `docs/16-*`) cubriendo setup, módulos, frontend y deploy.
- Archivo `.env.example` documentando variables de entorno requeridas.

### Changed
- `.gitignore` ampliado para cubrir node_modules, artefactos de build, claves criptográficas, dumps y capturas de debug.
- Pruebas E2E (`backend/tests/e2e-quiz.js`) parametrizadas: credenciales del administrador ahora se leen desde `E2E_ADMIN_USERNAME` y `E2E_ADMIN_PASSWORD`.

### Removed
- Banco de preguntas de certificación y sus derivados (`backend/src/seeds/parser/`) — contenido de terceros no publicable.
- Capturas de debug (`backend/tests/debug-home.png`, `backend/tests/debug-anon.png`).

### Security
- Credenciales reales de Neon y de administrador no se incluyen en el repositorio.
- `SESSION_SECRET` debe ser generado con `crypto.randomBytes(32).toString('hex')` antes de cualquier despliegue.

[v0.1.0]: https://github.com/Daardev/Proyecto-quiz/releases/tag/v0.1.0
[v0.2.0]: https://github.com/Daardev/Proyecto-quiz/compare/v0.1.0...v0.2.0
