# Fase 7: Sandbox y Submissions Module

## Objetivo
Implementar la ejecucion de codigo en Judge0 (sandbox) calculo de puntuacion por tests pasados y devolucion de resultados. Sin IA - la evaluacion es 100% basada en la ejecucion del codigo contra tests predefinidos.

---

### Paso 1: Configurar Judge0

Que hacer:
1. Obtener API key de Judge0 (via RapidAPI o self-hosted)
2. Agregar JUDGE0_API_URL y JUDGE0_API_KEY al .env

Pistas:
- Judge0 tiene dos opciones: RapidAPI (cloud limitado en free tier) o self-hosted (gratis pero requires Docker).
- Para desarrollo self-hosted es mejor porque no tiene rate limits.
- La URL de RapidAPI es algo como https://judge0-ce.p.rapidapi.com. La URL self-hosted es http://localhost:2358.

Que estudiar:
- Judge0 architecture: submission -> token -> polling -> result
- Self-hosted vs cloud: ventajas y desventajas
- Rate limits de Judge0 en RapidAPI free tier

---

### Paso 2: Crear sandbox.service.js

Que hacer:
Crear src/services/sandbox.service.js con:

1. Mapeo de lenguajes: tecnologia -> language_id de Judge0
   - JavaScript: 63 (Node.js 12.x)
   - Node.js: 63 (Node.js 12.x)
   - PostgreSQL: 0 (custom requiere configuracion adicional)

2. Configuracion por lenguaje: memory_limit (256MB) timeout (10s)

3. Whitelist de librerias permitidas (security check):
   - JavaScript: console Math Array Object String Number
   - Node.js: fs path http (limitado)
   - PostgreSQL: solo SQL puro

4. Funcion validateCodeSecurity(code technology):
   - Buscar patrones peligrosos con regex: require('child_process') eval( Function( document. window.
   - Retornar { valid: true } o { valid: false error: "mensaje" }

5. Funcion executeInSandbox(code technology tests):
   - Validar seguridad primero
   - Enviar codigo a Judge0 (POST /submissions)
   - Obtener token
   - Hacer polling hasta que status.id sea 3 (Accepted) o superior
   - Retornar resultado (stdout stderr status time memory)

Pistas:
- Judge0 devuelve un token inmediatamente despues del POST. El codigo NO se ejecuta aun. Esta en cola.
- Necesitas hacer GET a /submissions/{token} repetidamente hasta que status.id cambie de In Queue (1) o Processing (2) a un estado final (3 o mas).
- El polling debe tener un limite de intentos (10 intentos con 1s de intervalo = 10s maximo).
- status.id = 3 es Accepted (todo bien). IDs mas altos son errores (compilation error runtime error timeout etc).
- La whitelist de librerias NO es seguridad real (JS puede evadirla facilmente). Es una primera barrera. La seguridad real la da el sandbox de Judge0.

Que estudiar:
- Judge0 API: endpoints status codes formato de submission
- Polling pattern: while loop con setTimeout/setInterval timeout
- Regex para deteccion de patrones peligrosos
- Limitaciones de seguridad en sandbox: whitelist no es suficiente

---

### Paso 3: Implementar polling con timeout

Que hacer:
En executeInSandbox implementar polling:
1. POST a /submissions con source_code language_id memory_limit timeout
2. Guardar token de la respuesta
3. Loop: cada 1 segundo GET a /submissions/{token} y verificar status.id
4. Si status.id es 1 o 2 -> seguir esperando
5. Si status.id >= 3 -> retornar resultado
6. Si pasaron 10 segundos -> timeout retornar error

Pistas:
- No uses setInterval para polling dentro de una funcion async. Usa setTimeout recursivo o un loop con await new Promise(resolve => setTimeout(resolve, 1000)).
- Judge0 puede devolver status.id = 14 (timeout) si el codigo excede el limite. No es error tuyo es el codigo del usuario que es ineficiente.
- El timeout GENERAL (10s) es para Judge0 no para tu servidor. Tu servidor puede esperar mas (ej: 15s para dar margen).

Que estudiar:
- Polling vs WebSockets: diferencias y cuando usar cada uno
- setTimeout recursivo vs setInterval - ventajas de recursivo
- Judge0 status codes: lista completa y que significa cada uno

---

### Paso 4: Crear submissions.controller.js

Que hacer:
Crear src/controllers/submissions.controller.js con:

1. submitAnswer(req res):
   - Recibir quizId questionId code timeSpent
   - Validar campos requeridos
   - Obtener quizQuestion (relacion quiz + question + tests)
   - Validar que la pregunta pertenezca al quiz
   - Ejecutar sandbox con el codigo y los tests de la pregunta
   - Calcular score basado en tests pasados
   - Guardar submission en BD con sandboxResults
   - Retornar { submissionId score testsPassed testsTotal sandbox }

2. getQuizResults(req res):
   - Recibir quizId
   - Buscar quiz con todas las preguntas y submissions
   - Calcular score total sumando scores de cada submission
   - Marcar quiz como completado (completedAt)
   - Retornar estructura completa para frontend

Pistas:
- La evaluacion ahora es simple: ejecutar el codigo en Judge0 y comparar stdout con expected de cada test.
- calculateScore: score = (testsPasados / testsTotales) x 100 x dificultad. Esto da un score entre 0 y 300 por pregunta.
- El sandboxResults debe incluir: stdout stderr status time memory para cada test.
- Si el sandbox falla (timeout compilation error) el score es 0 pero la submission se guarda.
- getQuizResults debe funcionar aunque el quiz no este completo (puedes ver resultados parciales).
- No hay feedback de IA. El usuario sabe que fallo mirando los tests que fallaron y el stderr.

Que estudiar:
- Comparacion de strings: stdout vs expected (cuidado con espacios saltos de linea)
- Score calculation: porcentajes y pesos
- Drizzle: insert + returning queries con multiples relaciones
- Validacion de pertenencia: la pregunta pertenece realmente al quiz

---

### Paso 5: Agregar cola de reintentos para submissions fallidas

Que hacer:
Crear un sistema simple de reintentos:
1. Cuando una submission falle (sandbox timeout compilation error), agregarla a una cola de reintentos
2. La cola puede ser una tabla en BD (failed_submissions) o un array en memoria (para desarrollo)
3. Intentar re procesar cada submission fallida maximo 2 veces
4. Si despues de 2 reintentos sigue fallando, marcar como permanently_failed
5. Implementar un endpoint o funcion que re procese la cola periodicamente

Pistas:
- Para memoria: un array simple con { quizQuestionId code retryCount maxRetries }. Se procesa con setInterval cada 30 segundos.
- Para BD: tabla con id quizQuestionId code retryCount status (pending retrying failed) createdAt updatedAt.
- La cola NO debe bloquear el servidor. Procesa en background.
- Si el sandbox falla por timeout quizas el codigo es ineficiente. No reintentar indefinidamente.
- En memoria se pierde al reiniciar el servidor. Para persistencia real usa BD.

Que estudiar:
- Background jobs en Node: setInterval vs librerias como bull/bullmq
- Patron queue basico: enqueue dequeue process retry
- Manejo de fallos transitorios vs permanentes

---

### Paso 6: Crear rutas de submissions

Que hacer:
En submissions.routes.js:
1. POST /quizzes/:quizId/submit -> submitAnswer (protegido)
2. GET /quizzes/:quizId/results -> getQuizResults (protegido)

Pistas:
- El spec usa /submit (singular) en vez de /submissions (plural). Manten consistencia con el spec.
- El quizId viene en la URL el questionId y code en el body. Es intencional: quizId identifica el recurso los demas son datos de la accion.
- Montar en app.use('/api', submissionsRoutes).
- En el frontend el api-client.js debe llamar a /quizzes/:id/submit no /submissions.

---

---

### Paso 7: Probar flujo de submission

Que hacer:
1. Generar un quiz (POST /api/quizzes/generate)
2. Obtener pregunta actual (GET /api/quizzes/:id/current)
3. Enviar respuesta con codigo (POST /api/quizzes/:id/submit)
4. Verificar que recibe score testsPassed testsTotal y sandbox result
5. Obtener resultados (GET /api/quizzes/:id/results)
6. Verificar estructura completa de resultados

Pistas:
- Para probar puedes enviar codigo JavaScript simple como function sum(a,b) return a+b (si los tests esperan eso).
- Si Judge0 no esta configurado (self-hosted no corriendo) el sandbox va a fallar. Verifica que el sistema maneje este caso sin crash.
- Verifica que los scores se calculan correctamente comparando con los tests pasados.

---

## Checklist de verificacion

- [ ] Codigo se ejecuta en Judge0 correctamente
- [ ] Polling funciona (espera hasta que Judge0 termine)
- [ ] Seguridad validada (codigo con eval es rechazado)
- [ ] Submission guardada en BD con score y sandboxResults
- [ ] Score calculado correctamente segun tests pasados
- [ ] Resultados devuelven estructura completa
- [ ] Timeout de sandbox manejado gracefulmente
- [ ] Cola de reintentos funciona para submissions fallidas

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Judge0 no responde | Servicio no corriendo o URL incorrecta |
| Polling infinito | Judge0 nunca cambia status |
| Score siempre 0 | sandboxResult.status no es Accepted |
| question.technology is undefined | La pregunta no tiene campo technology |
| Tests no comparan bien | stdout tiene espacios o saltos extra |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Judge0 API | Ejecucion segura de codigo en contenedores |
| Polling pattern | Esperar resultados asincronos de APIs externas |
| Code security | Primera barrera contra codigo malicioso |
| Score calculation | Logica de negocio de puntuacion basada en tests |
| Background queues | Reintentar submissions fallidas sin bloquear |