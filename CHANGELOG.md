# Changelog

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
