# Fase 8: Questions y Quizzes Module

## Objetivo
Crear el flujo de quizzes: recibir el `language` del usuario, buscar preguntas predefinidas en BD según el lenguaje y servirlas una a una al frontend. **Modelo simplificado**: no hay filtro por categoría ni por dificultad, solo por lenguaje.

---

### Paso 1: Crear controlador generateQuiz

Que hacer:
En `questions.controller.js` crear funcion `generateQuiz`:
1. Extraer del body: `language`, `count`
2. Validar que `language` exista (400 si no)
3. Buscar preguntas activas en BD que coincidan con el `language`
4. Si no hay suficientes preguntas disponibles devolver error 404 con mensaje claro
5. Crear registro en tabla `quizzes` con el `userId` (si está autenticado, sino null) y el `language`
6. Para cada pregunta encontrada: crear relación en `quizQuestions` con el orden correspondiente
7. Retornar `{ quizId, count, totalAvailable, language }`

Pistas:
- La búsqueda de preguntas es una query con filtros. Usa `where()` con condiciones.
- El `count` es el número de preguntas que el usuario QUIERE. Si hay menos disponibles devuelves error.
- Puedes ordenar las preguntas al azar con `.orderBy(sql\`RANDOM()\`)` para que no siempre salgan las mismas.
- La creación de quiz + quizQuestions deberia ser una transaccion. Si falla la insercion de alguna pregunta el quiz no se crea.
- El endpoint NO requiere autenticación (puede crear quizzes anónimos).

Que estudiar:
- Drizzle queries con filtros: where() con multiples condiciones
- Transacciones en Drizzle: db.transaction() para atomicidad
- SQL random: como ordenar resultados aleatoriamente
- Paginacion basica: limit y offset para controlar cantidad de resultados

---

### Paso 2: Crear controlador getCurrentQuestion

#### Por que importa

`getCurrentQuestion` se llama **cada vez que el usuario carga `/quiz?quizId=X` y cada vez que avanza a la siguiente pregunta**. Es el endpoint más caliente del quiz.

El modelo de datos tiene 3 tablas relacionadas (quiz → quizQuestions → questions) y una cuarta auxiliar (submissions) para saber si la pregunta ya fue respondida. La forma naive de resolver esto trae la pregunta actual con el quiz + todas sus preguntas + la última submission de cada una... y es facil caer en un **N+1 query problem**.

#### Trampa comun: N+1 query problem

Con un bucle asi:

```js
for (const qq of qqRows) {
  const q = await db.select().from(questions).where(eq(questions.id, qq.questionId)).limit(1);
  const s = await db.select().from(submissions).where(eq(submissions.quizQuestionId, qq.id)).limit(1);
  // ...
}
```

Estas haciendo **2 queries adicionales por cada pregunta del quiz**. Con un quiz de 10 preguntas:
- 1 query para `quizzes`
- 1 query para `quizQuestions`
- **10 queries** para `questions` (1 por pregunta)
- **10 queries** para `submissions` (1 por pregunta)
- = **22 round-trips a Neon**

Cada round-trip a Neon cuesta ~50–200ms en Vercel Functions (latencia de red cloud, peor en cold start). Resultado: **0.5s a 1.5s de espera** cada vez que el usuario ve una pregunta. Eso rompe la percepcion de fluidez del quiz.

**Regla de oro**: cuando traes un recurso padre y necesitas N hijos relacionados, **traelos todos en una sola query con JOIN**. Una sola ida a la base de datos, latencia controlada por la red (no por N).

#### Como hacerlo bien ✅

Una sola query con `LEFT JOIN` + `LEFT JOIN LATERAL` resuelve todo en **2 round-trips totales** (1 para `quizzes`, 1 con todo el JOIN).

```js
// 1) Traer el quiz (1 round-trip).
const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);

// 2) Subquery lateral: la ULTIMA submission por cada quizQuestion.
const lastSub = db
  .select({
    id: submissions.id,
    quizQuestionId: submissions.quizQuestionId,
    code: submissions.code,
    sandboxResults: submissions.sandboxResults,
    score: submissions.score,
    evaluatedAt: submissions.evaluatedAt,
    kind: submissions.kind,
  })
  .from(submissions)
  .where(eq(submissions.quizQuestionId, quizQuestions.id))
  .orderBy(sql`${submissions.id} DESC`)
  .limit(1)
  .as('last_sub');

// 3) JOIN principal: todas las preguntas del quiz + ultima submission de cada una (1 round-trip).
const rows = await db.select({
  qqId: quizQuestions.id,
  qqOrder: quizQuestions.order,
  qqAttemptsCount: quizQuestions.attemptsCount,
  q: questions,
  subId: lastSub.id,
  subQuizQuestionId: lastSub.quizQuestionId,
  subCode: lastSub.code,
  subSandbox: lastSub.sandboxResults,
  // ... resto de columnas de la submission
})
  .from(quizQuestions)
  .leftJoin(questions, eq(questions.id, quizQuestions.questionId))
  .leftJoinLateral(lastSub, sql`true`)
  .where(eq(quizQuestions.quizId, quizId))
  .orderBy(quizQuestions.order);
```

Que hace cada pieza:
- **`leftJoin(questions, ...)`**: trae la pregunta completa (todas sus columnas) para cada `quizQuestion`. Si una pregunta fue borrada, queda `null` (LEFT, no INNER).
- **`leftJoinLateral(lastSub, ...)`**: subquery **correlacionada** que corre una vez por fila. Aqui es donde resides la potencia: para cada `quizQuestion`, trae la ultima submission (ordenada por `id DESC LIMIT 1`). Sin LATERAL tendrias que hacer una segunda query con agrupacion, que es menos eficiente.
- **`subId: lastSub.id`, etc**: cuando usas `leftJoinLateral` en Drizzle, **no puedes poner `lastSub` entero como una columna** (Postgres dice `subquery must return only one column`). Tienes que enumerar cada columna del subquery en el `select`.

Luego, en JavaScript:
4. Calculas `total = rows.length`.
5. Mapeas cada fila a `{ qq, question, submission }`. Si `subId` es `null`, la pregunta aun no tiene submission (aun no respondida).
6. Defines `isQuestionDone(sub)`: una pregunta esta "lista" si su submission es correcta (`sandboxResults.success === true && passed === total`) o si fue marcada como `kind: 'skipped'`. Cualquier otra cosa (incluido `null`) = pendiente.
7. Si todas las preguntas estan listas O `quiz.attemptsLeft <= 0`, devuelves `{ done: true, quizId }`. El frontend redirige a `/results`.
8. Si no, encuentras la primera pendiente (`ordered.find(o => !isQuestionDone(o.submission))`) y la devuelves como payload.

#### Que hacer (resumen)

Crear funcion `getCurrentQuestion(quizId)` (o `getCurrentQuestionData` si la quieres reutilizar desde SSR):
1. Recibir `quizId` como parametro.
2. Query a `quizzes` (1 round-trip).
3. Query con `LEFT JOIN` + `LEFT JOIN LATERAL` (1 round-trip). Devuelve todas las preguntas del quiz con su ultima submission.
4. Calcular en JS: total, `isQuestionDone`, "siguiente pendiente".
5. Devolver `{ done: true, quizId }` si todo resuelto o sin vidas; si no, devolver el payload de la siguiente pregunta (title, description, starterCode u options segun type, attemptsLeft, attemptsCount, maxAttempts). **Sin `testsTemplate`**.
6. **Extraer como funcion pura** `getCurrentQuestionData(quizId)` que devuelve el mismo payload (sin tocar `res`). Asi la reutilizas desde `GET /quiz` para SSR (ver Fase 10).

Pistas:
- NO devuelvas `testsTemplate` al frontend. El usuario no debe ver los tests antes de responder.
- Pregunta actual = primera en `qq.order` cuya submission NO cumple `isQuestionDone`.
- `LEFT JOIN` (no `INNER`) porque una pregunta puede no tener submission aun.
- **Reusa la misma funcion desde `GET /quiz` (Fase 10)** para inyectar la primera pregunta en SSR. No dupliques la query.
- `(quizQuestionId, attemptsCount, attemptsLeft)` es una buena clave para el `ETag`: si el cliente pide la misma pregunta y no se han consumido vidas, devuelves `304 Not Modified` y ahorras ancho de banda.

Que estudiar:
- **N+1 query problem** y la regla "1 round-trip por recurso relacionado"
- **JOIN vs N queries**: tradeoffs (memoria por filas completas vs latencia por round-trips)
- **`LATERAL JOIN`** en Postgres: subqueries correlacionadas por fila (mas potente que un `GROUP BY`)
- Como Drizzle expone `leftJoinLateral(sql\`...\`)` y por que hay que enumerar columnas
- **ETag / 304 Not Modified**: ahorra bytes cuando el contenido no cambia
- Reutilizacion de funciones puras entre HTTP y SSR (misma logica, distinto consumidor)

---

### Paso 3: Crear controlador getLanguages

Que hacer:
Crear funcion `getLanguages` que retorne la lista distinta de lenguajes disponibles:
- Hace `SELECT DISTINCT language FROM questions WHERE is_active = true`
- Devuelve `{ languages: ['javascript', 'sql'] }`

Pistas:
- Este endpoint alimenta el dropdown de seleccion de lenguaje en `/`
- Solo se listan lenguajes que tienen al menos una pregunta activa

---

### Paso 4: Crear rutas de questions

Que hacer:
En `questions.routes.js`:
1. `GET /languages` → `getLanguages` (publico)
2. `POST /quizzes/generate` → `generateQuiz` (publico, anonimo permitido)
3. `GET /quizzes/:quizId/current` → `getCurrentQuestion` (publico)

Pistas:
- El parametro `:quizId` en la ruta se accede con `req.params.quizId`. Express lo convierte a string - parsea a integer con `parseInt()`.
- Las rutas protegidas deben ir con el middleware `isAuthenticated` ANTES del controlador. Si lo pones despues no protege nada.
- El prefijo `/api` se define al montar en `app.js`. Dentro del router las rutas son relativas.

Que estudiar:
- Express route params: :id req.params
- Middleware chain: como se ejecutan en orden (route -> middleware -> controller)
- Proteccion de rutas: middleware de auth selectivo

---

### Paso 5: Integrar en app.js

Que hacer:
En `app.js`:
1. Importar `questionsRoutes` desde `./routes/questions.routes.js`
2. Montar en `app.use('/api', questionsRoutes)`
3. **Importar tambien `getCurrentQuestionData`** desde el controller (funcion pura, sin `req`/`res`).
4. **Convertir `GET /quiz` en asincrona**: si la query trae `quizId`, ejecuta `getCurrentQuestionData(quizId)` y pasa el resultado a Handlebars como `firstQuestion`. Asi la primera pregunta viaja ya resuelta en el HTML y el cliente no necesita un `fetch` extra para mostrarla.

Pistas:
- Ya montaste `questionsRoutes` en la Fase 3 para `/api/languages`. Solo verifica que las nuevas rutas tambien estan incluidas.
- Si montas multiples routers en `/api` el orden importa. Express busca coincidencias en el orden que se registraron.
- `GET /quiz` se vera en detalle en la **Fase 10 (Paso 7)**. Aqui solo dejamos el wiring: importar `getCurrentQuestionData`, leer `req.query.quizId` y pasarlo a Handlebars. Si el query string no trae `quizId` (modo "vista limpia"), pasa `firstQuestion = null` y el cliente hara el `fetch` igual que antes.
- **No dupliques la query en `GET /quiz`**. Reutiliza exactamente `getCurrentQuestionData` — asi si en el futuro cambias como se elige la "siguiente pregunta", el SSR y el endpoint se mantienen consistentes.

---

### Paso 6: Probar flujo de generacion

Que hacer:
1. Iniciar servidor
2. `GET /api/languages` → debe devolver `['javascript', 'sql']`
3. `POST /api/quizzes/generate` con body: `{ language: 'sql', count: 3 }` (anonimo, sin auth)
4. Verificar que responde con `{ quizId, count, totalAvailable, language }`
5. Verificar en BD que las relaciones `quiz_questions` se crearon
6. Probar `GET /api/quizzes/:id/current` y verificar que devuelve una pregunta

Pistas:
- Para probar POST desde el navegador necesitas una herramienta como Postman Insomnia o curl.
- Si no estas autenticado el endpoint funciona (permite quiz anonimo).
- Si el endpoint responde 404 es que no hay suficientes preguntas para ese lenguaje.
- Si responde 500 revisa los logs del servidor.

Que estudiar:
- Probar APIs con curl Postman o Insomnia
- Debugging de errores 500: leer stack traces logs
- Verificacion en BD: Neon Console pgAdmin Drizzle Studio

---

### Checklist de verificacion

- [ ] `POST /api/quizzes/generate` crea quiz con preguntas predefinidas (sin filtro de categoría)
- [ ] Si no hay suficientes preguntas devuelve error claro
- [ ] `GET /api/quizzes/:id/current` devuelve pregunta sin tests (sin `testsTemplate`)
- [ ] `GET /api/quizzes/:id/current` devuelve `{ done: true }` cuando todo esta respondido
- [ ] `GET /api/languages` devuelve la lista distinta de lenguajes
- [ ] Quiz anonimo (sin auth) funciona correctamente
- [ ] **`GET /api/quizzes/:id/current` ejecuta como maximo 2 queries** a la BD (verificable con `console.time` o activando logs de Drizzle)
- [ ] **Latencia del endpoint < 300 ms p95** en local con seed cargado (medible con `curl` + `time` o desde el navegador en Network tab)

---

### Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 404 no hay preguntas | No hay preguntas para ese lenguaje (revisar seed) |
| Preguntas siempre iguales | Falta ordenamiento aleatorio (`ORDER BY RANDOM()`) |
| `quizId` undefined en respuesta | `returning()` no se uso o se uso mal |
| 500 al crear quiz | Error en transaccion o FK incorrecta |
| Pregunta no tiene starterCode | Seed incompleto o tipo mal definido |
| **Latencia 0.5–1s al mostrar la pregunta** | **N+1 query problem** — convertir el bucle `for` en un JOIN unico (`leftJoin` + `leftJoinLateral`) |
| **Error `subquery must return only one column`** | Estas poniendo el subquery lateral completo (`lastSub`) como columna en `select`. Hay que enumerar cada columna (`lastSub.id`, `lastSub.code`, etc). |
| **El navegador pide la misma pregunta y la red gasta bytes innecesarios** | Falta `ETag` + manejo de `If-None-Match` para devolver `304 Not Modified` |

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Query con filtros simples | Buscar preguntas por lenguaje unico |
| Transacciones | Atomicidad al crear quiz con preguntas |
| SQL random | Ordenar preguntas aleatoriamente |
| Proteccion selectiva | Endpoints publicos vs protegidos |
| Validacion de entrada | Nunca confies en el cliente |
| Modelo simplificado | Solo `language` como filtro, sin jerarquias |
| **N+1 query problem** | La trampa mas comun en ORMs: 1 query por hijo = latencia lineal en N. |
| **JOIN + LATERAL JOIN** | Resuelve N+1 en 1 sola query correlacionada. Patron base para recursos con hijos. |
| **Funcion pura reutilizable** | Misma logica (`getCurrentQuestionData`) para el endpoint HTTP y para el SSR de `GET /quiz`. No duplicar queries. |
| **SSR de la primera pregunta** | Render en servidor evita el primer `fetch` del cliente → percepcion instantanea. |
| **ETag / 304** | Cache condicional en HTTP: ahorra bytes cuando el contenido no cambia. |
