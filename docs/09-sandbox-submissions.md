# Fase 9: Sandbox y Submissions Module

## Objetivo
Implementar la ejecucion de codigo en WebAssembly (QuickJS para JavaScript, PGlite para SQL), calculo de puntuacion por tests pasados y devolucion de resultados. La evaluacion es deterministica: depende solo de la ejecucion del codigo contra tests predefinidos. Toda la ejecucion es local (sin servicios externos).

**Modelo simplificado**: el sandbox se elige por `language` de la pregunta (`'javascript'` | `'sql'`). No hay niveles de dificultad.

---

### Paso 1: Instalar dependencias del sandbox

Que hacer:
- `npm install quickjs-emscripten @electric-sql/pglite`

Pistas:
- `quickjs-emscripten` es el engine JavaScript compilado a WebAssembly. Es JS-spec compliant, sandboxed por diseño y no expone APIs del sistema (no `fs`, no `http`, no `process`).
- `@electric-sql/pglite` es PostgreSQL real compilado a WebAssembly. Ejecuta SQL completo (DDL + DML) en proceso, sin servidor externo.
- Bundle adicional total: ~6 MB (3 MB por paquete, despues de compresion Vercel).
- Cold start: primera ejecucion tarda ~200-500 ms por la carga del WASM. Las siguientes son instantaneas (singleton del runtime).

Que estudiar:
- WebAssembly: ejecucion sandboxed, memory-safe, portable
- QuickJS: motor JS ligero (~3 MB) usado para sandboxing
- PGlite: PostgreSQL embebido via WASM por ElectricSQL

---

### Paso 2: Crear `sandbox.service.js`

Que hacer:
Crear `src/services/sandbox.service.js` con:

1. **Modulo cache**: variable singleton para QuickJS runtime (se carga lazy en primera llamada)

2. `executeJavaScript(userCode, tests)`:
   - Extrae el nombre de la primera funcion definida en `userCode` (regex)
   - Crea contexto QuickJS
   - Para cada test: envuelve `userCode` + llamada `fnName(...test.input)` + `JSON.stringify(result)`
   - Compara `actual` con `JSON.stringify(test.expected)`
   - Libera handles con `.dispose()` para evitar memory leaks

3. `executePostgres(userCode, tests)`:
   - Crea instancia de PGlite (DB en memoria)
   - Ejecuta `userCode` (CREATE TABLE + INSERTs)
   - Para cada test: corre `db.query(test.input)` y compara `result.rows` con `test.expected`

4. `executeCodeInSandbox(code, language, tests)`:
   - Dispatcher: `'javascript'` -> `executeJavaScript`, `'sql'` -> `executePostgres`

5. `evaluateMultipleChoice(userAnswer, correctOption)`:
   - Compara el índice con la respuesta correcta
   - Retorna `{ success: true, passed: 0|1, total: 1, results: [...] }`

Pistas:
- WASM es memory-safe. No hace falta validar el código del usuario con regex.
- El sandbox es sincronico y local. No hay polling ni retries.
- Cada pregunta crea su propio contexto (limpieza automática via dispose).

---

### Paso 3: Sistema de Puntuación (simplificado)

Score por pregunta = `(testsPasados / testsTotales) × 100`

- **Máximo 100 puntos por pregunta**
- NO hay multiplicador de dificultad
- Score total = suma de scores de cada pregunta

```js
const score = sandboxResult.success && sandboxResult.total > 0
  ? Math.round((sandboxResult.passed / sandboxResult.total) * 100)
  : 0;
```

---

### Paso 4: Crear `submissions.controller.js`

Que hacer:
Crear `src/controllers/submissions.controller.js` con dos funciones:

1. `submitAnswer(req, res)`:
   - Recibir `quizId`, `questionId`, `code` o `answer`
   - Buscar el `quizQuestion` y su pregunta con `language`
   - Si `type === 'multiple_choice'`: llama `evaluateMultipleChoice(answer, correctOption)`
   - Si `type === 'code'`: dispatcha segun `language` (`'sql'` -> PGlite, otros -> QuickJS)
   - Calcular score sin multiplicador
   - Si hay usuario autenticado, persistir la submission
   - Retornar `{ submissionId, saved, score, testsPassed, testsTotal, sandbox }`

2. `getQuizResults(req, res)`:
   - Recibir `quizId`
   - Buscar quiz con preguntas y submissions
   - Marcar quiz como completado
   - Calcular score total
   - Retornar estructura completa con `language` del quiz

Pistas:
- El campo `language` de la pregunta determina el sandbox (no el `categoryId` antiguo)
- Si el sandbox falla (timeout, comp error) el score es 0 pero la submission se guarda
- Anónimo puede jugar pero las submissions no se persisten

---

### Paso 5: Rutas de submissions

Que hacer:
En `submissions.routes.js`:
1. `POST /quizzes/:quizId/submit` → `submitAnswer` (publico, anonimo permitido)
2. `GET /quizzes/:quizId/results` → `getQuizResults` (publico)

Pistas:
- El spec usa `/submit` (singular). El frontend debe llamar a `/api/quizzes/:id/submit`.
- El `quizId` viene en la URL el `questionId` y `code` o `answer` en el body.
- Montar en `app.use('/api', submissionsRoutes)`.

---

### Checklist de verificacion

- [ ] Codigo se ejecuta en sandbox WASM correctamente (QuickJS o PGlite)
- [ ] Preguntas MC se evaluan comparando índice con respuesta correcta
- [ ] Submission guardada en BD con score (max 100)
- [ ] Score calculado correctamente segun tests pasados
- [ ] Resultados devuelven estructura completa con `language`
- [ ] Sandbox failures capturados sin crashear el server

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| WebAssembly | Ejecucion segura de codigo en contenedores |
| Sandbox local | Sin servicios externos, sin rate limits, sin costos |
| Multiple choice | Comparacion simple de índice, sin sandbox |
| Puntuación fija | 100 max por pregunta, sin niveles |
| Estructura de submissions | Codigo + sandbox results + score en BD |
