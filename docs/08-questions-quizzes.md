# Fase 8: Questions y Quizzes Module

## Objetivo
Crear el flujo de quizzes: recibir parametros del usuario buscar preguntas predefinidas en BD y servirlas una a una al frontend. Las preguntas son estaticas: se eligen al inicio del quiz y persisten durante la sesion.

---

### Paso 1: Crear controlador generateQuiz

Que hacer:
En questions.controller.js crear funcion generateQuiz:
1. Extraer del body: technology category difficulty count
2. Validar que todos los campos requeridos existan (400 si no)
3. Obtener IDs de technologia y categoria desde BD
4. Buscar preguntas predefinidas que coincidan con:
   - categoryId de la categoria seleccionada
   - difficulty igual o similar (ej: si piden dificultad 2 traer dificultades 1-3)
   - Maximo count preguntas
5. Si no hay suficientes preguntas disponibles devolver error 404 con mensaje claro
6. Crear registro en tabla quizzes con el userId del usuario autenticado
7. Para cada pregunta encontrada:
   - Crear relacion en quizQuestions con el orden correspondiente
8. Retornar { quizId count totalAvailable }

Pistas:
- La busqueda de preguntas es una query con filtros. Usa where() con multiples condiciones.
- El count es el numero de preguntas que el usuario QUIERE. Si hay menos disponibles devuelves las que hay o un error.
- Puedes ordenar las preguntas por dificultad o al azar con .orderBy(sql`random()`) para que no siempre salgan las mismas.
- La creacion de quiz + quizQuestions deberia ser una transaccion. Si falla la insercion de alguna pregunta el quiz no se crea.
- El endpoint requiere autenticacion porque necesitas el userId para el quiz.

Que estudiar:
- Drizzle queries con filtros: where() con multiples condiciones
- Transacciones en Drizzle: db.transaction() para atomicidad
- SQL random: como ordenar resultados aleatoriamente
- Paginacion basica: limit y offset para controlar cantidad de resultados

---

### Paso 2: Crear controlador getCurrentQuestion

Que hacer:
Crear funcion getCurrentQuestion:
1. Recibir quizId de params
2. Buscar quiz con todas sus preguntas y relaciones
3. Determinar cual es la pregunta actual (primera sin submission)
4. Devolver la pregunta (title description starterCode) sin el tests_template (no debes mostrar los tests al usuario)

Pistas:
- NO devuelvas testsTemplate al frontend. El usuario no debe ver los tests antes de responder.
- Pregunta actual = primera pregunta en orden que no tenga una submission asociada.
- Para saber si una pregunta tiene submission necesitas hacer un LEFT JOIN con submissions.
- Si todas las preguntas estan respondidas devuelve { done: true } para que el frontend redirija a resultados.

Que estudiar:
- Drizzle queries con relaciones: with clause anidado (quiz -> quizQuestions -> question)
- Filtrado de preguntas respondidas vs no respondidas
- LEFT JOIN vs INNER JOIN en contexto de quizzes
- Que informacion NO debes exponer al frontend (tests hash etc)

---

### Paso 3: Crear controlador getTechnologies (ajuste)

Que hacer:
Verificar que el getTechnologies de la Fase 3 sigue funcionando:
1. Debe devolver tecnologias con sus categorias anidadas
2. Agregar la categoria description si no estaba incluida

Pistas:
- Este endpoint es publico (no requiere auth). Si esta protegido por error revisa las rutas.
- La respuesta debe incluir: id name icon description categories con id name description dentro.

---

### Paso 4: Crear rutas de questions

Que hacer:
En questions.routes.js:
1. GET /technologies -> getTechnologies (publico)
2. POST /quizzes/generate -> generateQuiz (protegido con isAuthenticated)
3. GET /quizzes/:quizId/current -> getCurrentQuestion (protegido)

Pistas:
- El parametro :quizId en la ruta se accede con req.params.quizId. Express lo convierte a string - parsea a integer con parseInt().
- Las rutas protegidas deben ir con el middleware isAuthenticated ANTES del controlador. Si lo pones despues no protege nada.
- El prefijo /api se define al montar en app.js. Dentro del router las rutas son relativas.

Que estudiar:
- Express route params: :id req.params
- Middleware chain: como se ejecutan en orden (route -> middleware -> controller)
- Proteccion de rutas: middleware de auth selectivo

---

### Paso 5: Integrar en app.js

Que hacer:
En app.js:
1. Importar questionsRoutes desde ./routes/questions.routes.js
2. Montar en app.use('/api', questionsRoutes)

Pistas:
- Ya montaste questionsRoutes en la Fase 3 para /api/technologies. Solo verifica que las nuevas rutas tambien estan incluidas.
- Si montas multiples routers en /api el orden importa. Express busca coincidencias en el orden que se registraron.

---

### Paso 6: Probar flujo de generacion

Que hacer:
1. Iniciar servidor
2. Autenticarse (hacer login con Google)
3. Hacer POST a http://localhost:3001/api/quizzes/generate con body: { technology: JavaScript category: Arrays difficulty: 2 count: 5 }
4. Verificar que responde con { quizId count totalAvailable }
5. Verificar en BD que las relaciones quiz_questions se crearon
6. Probar GET /api/quizzes/:id/current y verificar que devuelve una pregunta

Pistas:
- Para probar POST desde el navegador necesitas una herramienta como Postman Insomnia o curl.
- Si no estas autenticado recibiras 401. Primero haz login.
- Si el endpoint responde 404 es que no hay suficientes preguntas para esa combinacion tech/cat/difficulty.
- Si responde 500 revisa los logs del servidor.

Que estudiar:
- Probar APIs con curl Postman o Insomnia
- Debugging de errores 500: leer stack traces logs
- Verificacion en BD: Neon Console pgAdmin Drizzle Studio

---

## Checklist de verificacion

- [ ] POST /api/quizzes/generate crea quiz con preguntas predefinidas
- [ ] Si no hay suficientes preguntas devuelve error claro
- [ ] GET /api/quizzes/:id/current devuelve pregunta sin tests
- [ ] GET /api/quizzes/:id/current devuelve { done: true } cuando todo esta respondido
- [ ] Rutas protegidas requieren autenticacion
- [ ] GET /api/technologies sigue funcionando (publico)

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 404 no hay suficientes preguntas | Pocas preguntas en BD para esa combinacion |
| Preguntas siempre iguales | Falta ordenamiento aleatorio |
| quizId es undefined en respuesta | returning() no se uso o se uso mal |
| 500 al crear quiz | Error en transaccion o FK incorrecta |
| Pregunta no tiene starterCode | Seed de preguntas incompleto |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Query con filtros | Buscar preguntas por categoria dificultad y mas |
| Transacciones | Atomicidad al crear quiz con preguntas |
| SQL random | Ordenar preguntas aleatoriamente |
| LEFT JOIN | Saber que preguntas tienen submission |
| Proteccion selectiva | Algunas rutas publicas otras protegidas |
| Validacion de entrada | Nunca confies en el cliente |