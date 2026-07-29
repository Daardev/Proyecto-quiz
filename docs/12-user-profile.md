# Fase 10: Panel de Usuario

## Objetivo
Crear una pagina `/profile` donde el usuario autenticado vea sus datos personales, estadisticas globales e historial de quizzes completados. Solo se muestran datos individuales (sin ranking, sin codigo de submissions, sin fotos de perfil).

---

### Paso 1: Crear rutas del perfil

Que hacer:
Crear `src/routes/profile.routes.js` con:
1. `GET /` (dentro del router montado en `/profile`) -> `getProfile`
2. `GET /api/quizzes` (dentro del router montado en `/api/users/me`) -> `getMyQuizzesApi`
3. `GET /api/stats` (dentro del router montado en `/api/users/me`) -> `getMyStatsApi`

Montar en `app.js`:
- `app.use('/profile', isAuthenticated, profileRoutes)` — solo usuarios autenticados
- `app.use('/api/users/me', isAuthenticated, userMeRoutes)` — solo usuarios autenticados

Pistas:
- Separa el router de la vista (`profileRoutes`) del router de la API JSON (`userMeRoutes`). Asi no mezclas respuestas HTML con JSON en el mismo archivo.
- Ambos routers requieren `isAuthenticated`. Sin sesion el middleware rechaza con 401 antes de llegar al controlador.
- Los endpoints JSON son para extensibilidad futura (una SPA o un cliente AJAX). Por ahora la vista consume la logica directamente desde el controlador.

Que estudiar:
- Separacion de routers: vistas vs API
- Reutilizacion de middleware: isAuthenticated en multiples routers
- Patron REST: `/recurso` para HTML `/api/recurso` para JSON

---

### Paso 2: Crear controlador del perfil

Que hacer:
Crear `src/controllers/profile.controller.js` con tres funciones:

1. `getProfile(req, res)`:
   - Obtener `userId` de `req.user.id`
   - Llamar funcion que devuelve quizzes del usuario (Paso 4)
   - Llamar funcion que calcula stats (Paso 5)
   - Renderizar `profile.hbs` con `{ quizzes, stats }` (el user viene por `res.locals.user` configurado en Fase 5)

2. `getMyQuizzesApi(req, res)`:
   - Obtener `userId` de `req.user.id`
   - Llamar funcion del Paso 4
   - Devolver `res.json({ quizzes })`

3. `getMyStatsApi(req, res)`:
   - Obtener `userId` de `req.user.id`
   - Llamar funcion del Paso 5
   - Devolver `res.json({ stats })`

Pistas:
- El user NO se pasa manualmente al render: ya esta disponible via `res.locals.user` (configurado en el Paso 4 de Fase 5 con el middleware global). Esto evita repetir `user: req.user` en cada `res.render()`.
- Si las funciones del Paso 4 y 5 son async/await, asegurate de envolver en try/catch para no crashear el server si la BD falla.
- Para quizzes anonimos: `quizzes.userId` puede ser null. La query SIEMPRE filtra por `WHERE user_id = $1`, asi que un usuario nunca ve quizzes ajenos.

Que estudiar:
- `res.locals` en Express: variables disponibles en todas las vistas
- try/catch en controladores async
- Reutilizacion de funciones entre render y JSON

---

### Paso 3: Crear vista profile.hbs

Que hacer:
Crear `src/views/pages/profile.hbs` con estructura que extienda el layout `main.hbs`. La pagina tiene 3 secciones: datos del usuario, stats (4 cards) e historial (tabla).

Fragmento clave (la condicion del estado vacio es la parte mas importante):
```handlebars
{{#if quizzes.length}}
  <table>... filas con {{#each quizzes}} ... {{/each}}</table>
{{else}}
  <p>Aun no has completado ningun quiz. <a href="/">Inicia tu primer quiz</a></p>
{{/if}}
```

Tambien necesitas esta condicion por fila (para distinguir Completado vs Abandonado):
```handlebars
<td>{{#if this.completedAt}}Completado{{else}}Abandonado{{/if}}</td>
```

Pistas:
- El navbar se incluye con `{{> navbar}}` (partial). Sin esto el header comun no aparece.
- `{{user.name}}` viene de `res.locals.user` configurado en Fase 5. NO lo pases manualmente en el render.
- `{{formatDate ...}}` es un helper de Handlebars. Si no lo registras, Handlebars mostrara el objeto Date crudo o algo ilegible. Registralo en el Paso 6.
- `{{#if quizzes.length}}` evita errores si el array es undefined o vacio.
- El `{{else}}` en Handlebars se usa para el caso negativo del `{{#if}}`. No es un bloque separado.
- Score se muestra como porcentaje con el `%` literal en la plantilla.

Que estudiar:
- Handlebars: `{{> partial}}` `{{#each}}` `{{#if}}` `{{else}}`
- Helpers de Handlebars: que son y como se registran
- Estado vacio en UI: importancia de mostrar algo cuando no hay datos

---

### Paso 4: Query de quizzes del usuario

Que hacer:
Crear funcion `getUserQuizzes(userId)` en `profile.controller.js` (o en `quizzes.controller.js` si prefieres centralizar):

Logica de la query:
1. JOIN con `technologies` y `categories` (LEFT JOIN porque category es nullable)
2. LEFT JOIN con `quiz_questions` y `submissions` para incluir quizzes sin respuestas
3. Calcular score como porcentaje: `SUM(s.score) / SUM(qq.difficulty * 100) * 100`
4. Si no hay submissions el score es 0 (usar `COALESCE` o `CASE WHEN s.score IS NULL THEN 0`)
5. Filtrar SIEMPRE por `WHERE q.user_id = $1`
6. `GROUP BY q.id` para poder agregar
7. `ORDER BY q.started_at DESC` (mas reciente primero)

Fragmento clave (la formula del score):
```sql
COALESCE(
  SUM(s.score)::float / NULLIF(SUM(qq.difficulty * 100), 0) * 100,
  0
)::int AS score
```

Sobre la formula del score (porcentaje):
- En Fase 7 cada submission guarda `score = (testsPasados/testsTotales) * 100 * dificultad`
- Para volver a porcentaje sobre 100: dividir entre `(dificultad * 100)` y multiplicar por 100
- `NULLIF(..., 0)` evita division por cero cuando no hay preguntas
- `COALESCE(..., 0)` convierte el NULL final en 0 para que la vista no muestre "NaN%"

La funcion:
1. Recibe `userId` (integer)
2. Ejecuta la query con Drizzle o SQL crudo
3. Transforma cada fila a objeto `{ id, technology, category, startedAt, completedAt, score }` (camelCase para JS)
4. Retorna array

Pistas:
- `LEFT JOIN` con `categories` es necesario porque `quizzes.categoryId` es nullable.
- `LEFT JOIN` con `submissions` permite contar quizzes que no tienen respuestas todavia.
- `GROUP BY q.id` para poder usar `SUM()`. Sin GROUP BY las agregaciones no funcionan.
- `COALESCE(SUM(...), 0)` evita que el score retorne NULL cuando no hay submissions.
- El cast `::int` trunca decimales. Si prefieres mas precision usa `::numeric(5,2)` o redondea en JS.
- `ORDER BY q.started_at DESC` muestra el quiz mas reciente primero.
- En Drizzle: el `LEFT JOIN` se hace con `leftJoin()` o con `.leftJoin` en el query builder. Revisa la doc de Drizzle para joins complejos.

Que estudiar:
- SQL agregaciones: `AVG` `SUM` `COUNT` con `GROUP BY`
- `LEFT JOIN` vs `INNER JOIN`: cuando usar cada uno
- `COALESCE`: manejo de NULLs en SQL
- `NULLIF`: cuando usarlo para evitar division por cero
- Drizzle joins: `leftJoin()` `innerJoin()` `fullJoin()`

---

### Paso 5: Calcular estadisticas

Que hacer:
Crear funcion `getUserStats(userId)` en `profile.controller.js`:

Logica de la query:
1. Contar quizzes completados: `COUNT(*) FILTER (WHERE completed_at IS NOT NULL)`
2. Contar quizzes abandonados: `COUNT(*) FILTER (WHERE completed_at IS NULL)`
3. Score promedio: subquery que calcula `SUM(s.score) / SUM(qq.difficulty * 100) * 100` por quiz, luego `AVG()` sobre esos
4. Mejor score: subquery igual pero con `MAX()` en vez de `AVG()`
5. `COALESCE(..., 0)` para evitar NaN cuando no hay quizzes
6. Filtrar siempre por `WHERE q.user_id = $1`

Fragmento clave (el conteo condicional):
```sql
COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS total_completed,
COUNT(*) FILTER (WHERE completed_at IS NULL) AS total_abandoned
```

La funcion:
1. Recibe `userId`
2. Ejecuta la query
3. Transforma resultado a objeto `{ totalCompleted, totalAbandoned, averageScore, bestScore }` (camelCase)
4. Retorna objeto

Pistas:
- `COUNT(*) FILTER (WHERE ...)` es SQL estandar para contar condicionalmente. Mas limpio que `COUNT(CASE WHEN ...)`.
- El subquery `FROM (...)` calcula score total por quiz y lo maximo posible (sumando `difficulty * 100` por pregunta). Asi podemos calcular el porcentaje correctamente.
- `FILTER (WHERE completed_at IS NOT NULL)` en el count outer cuenta solo quizzes TERMINADOS.
- `COALESCE(..., 0)` evita problemas si el usuario no tiene quizzes completados.
- `ROUND(AVG(...))` redondea para que el score sea un entero (o usa 2 decimales si prefieres).
- Si esto parece muy complejo, alternativa: calcular el promedio y mejor score en JavaScript desde el array de quizzes del Paso 4. Mas lento pero mas simple.

Que estudiar:
- `FILTER (WHERE ...)` en SQL: agregado condicional
- Subqueries: cuando son necesarios vs cuando se puede hacer en una sola query
- Alternativas: SQL vs calculo en JS — tradeoffs

---

### Paso 6: Registrar helper de fecha en Handlebars

Que hacer:
En `app.js` donde configuras `express-handlebars`, registrar el helper `formatDate`. Se registra UNA vez y queda disponible en TODAS las vistas.

Fragmento clave (el cuerpo del helper, lo unico que es especifico):
```javascript
hbs.handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
});
```

Notas:
- `toLocaleDateString` es API nativa de JS, no requiere librerias externas.
- Para fechas con hora: agrega `hour: '2-digit'` y `minute: '2-digit'`.
- Locale `'es-ES'` da formato espanol. Usa `'en-US'` para ingles.
- Si date es null/undefined retorna string vacio para no romper la vista.

Pistas:
- Handlebars sin helper de fecha mostrara el timestamp crudo (`2026-07-20T15:30:00.000Z`) que es feo en pantalla.
- El helper se registra UNA VEZ en app.js. Despues esta disponible en TODAS las vistas.
- El registro debe hacerse DESPUES de `const hbs = engine({...})` y ANTES de `app.engine('hbs', hbs)`.

Que estudiar:
- Handlebars helpers: que son y como se registran
- `Intl.DateTimeFormat`: API nativa de JS para fechas internacionalizadas
- Libreria `date-fns`: cuando es util vs usar nativo

---

### Paso 7: Crear partial navbar.hbs

Que hacer:
Crear `src/views/partials/navbar.hbs` con la barra de navegacion comun. Tiene 3 estados: sin login, login normal, login admin. La estructura basica es `<nav>` + `<ul>` de links + condicionales.

Fragmento clave (las dos condicionales mas importantes):
```handlebars
{{#if user}}
  <li><a href="/profile">Mi perfil</a></li>
  {{#if isAdmin}}
    <li><a href="/admin">Admin</a></li>
  {{/if}}
  <form action="/api/auth/logout" method="POST" style="display:inline">
    <button type="submit">Cerrar sesion</button>
  </form>
{{else}}
  <li><a href="/api/auth/google">Iniciar sesion</a></li>
{{/if}}
```

Pistas:
- El navbar lee `user` y `isAdmin` de `res.locals` (configurado en Fase 5 con middleware global).
- `{{#if user}}` muestra links de usuario logueado. `{{#if isAdmin}}` agrega link admin solo si corresponde.
- El logout es un form POST, no un link GET. Esto sigue las mejores practicas de seguridad (CSRF).
- El form POST requiere que `/api/auth/logout` acepte form data (Express ya lo hace con `express.urlencoded()`).
- Si tu layout `main.hbs` no incluye el navbar todavia, agregalo con `{{> navbar}}` dentro del `<body>`.

Que estudiar:
- Handlebars partials: registro automatico de archivos en `partialsDir`
- HTML semantico: `<nav>` para barras de navegacion
- Logout por POST vs GET: por que se usa POST
- CSRF: que es y por que los forms POST son mas seguros

---

### Paso 8: Probar flujo completo

Que hacer:
1. Iniciar servidor con `npm run dev`
2. Login con Google (ir a `/api/auth/google`)
3. Confirmar que el navbar muestra tu nombre y link "Mi perfil"
4. Sin quizzes: ir a `/profile` → ver estado vacio "Aun no has completado ningun quiz"
5. Crear un quiz desde `/`, completarlo, ir a `/profile`
6. Verificar que aparece en historial con score y "Completado"
7. Crear otro quiz pero salir sin terminar → aparece como "Abandonado"
8. Crear varios quizzes → verificar que score promedio se calcula correctamente
9. Logout → intentar ir a `/profile` → redirige a login
10. Login con OTRO usuario → ver SOLO sus quizzes (no los del usuario anterior)

Errores comunes:
- Navbar muestra "undefined" para `user.name` → falta `res.locals.user` en middleware global (Fase 5)
- `/profile` da 404 → el router no esta montado en app.js
- Score aparece como "NaN%" → division por cero cuando no hay quizzes (cubierto por COALESCE)
- Historial vacio aunque tenga quizzes → query mal escrita o `WHERE user_id` no coincide con el user logueado
- Fecha aparece como "Invalid Date" → no se registro el helper `formatDate`
- Veo quizzes de OTRO usuario → olvidaste `WHERE q.user_id = $1` en la query

Pistas:
- Si ves "Cannot GET /profile" el router no esta montado. Revisa app.js.
- Si ves "user is not defined" en la vista, el middleware `res.locals.user` no esta configurado.
- Si la pagina se ve sin estilos (CSS faltante), verifica que `main.css` este siendo servido y que la vista use `<link>` correcto.

Que estudiar:
- Debugging de middleware: como verificar que un middleware se ejecuta
- Aislamiento por usuario: importancia de WHERE en queries autenticadas
- Pruebas multi-usuario: como validar que la autorizacion funciona

---

## Checklist de verificacion

- [ ] GET /profile renderiza la vista con datos del usuario
- [ ] Seccion de datos personales funciona (nombre email fecha)
- [ ] Seccion de stats calcula correctamente (4 cards)
- [ ] Historial muestra quizzes ordenados por fecha DESC
- [ ] Estado vacio aparece si no hay quizzes
- [ ] Quiz abandonado se distingue del completado
- [ ] Navbar muestra "Mi perfil" cuando esta logueado
- [ ] Navbar muestra "Admin" si el usuario es admin
- [ ] Sin auth /profile redirige a /api/auth/google
- [ ] Usuario A no ve quizzes de Usuario B
- [ ] Helper formatDate funciona en las fechas
- [ ] Score se muestra como porcentaje (0-100)
- [ ] Score es 0% si no hay quizzes completados (no NaN)

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| user is not defined en vista | Falta middleware `res.locals.user` en app.js |
| Cannot GET /profile | Router no montado en app.js |
| Navbar muestra "undefined" | Middleware res.locals.user no registrado |
| Score aparece como "NaN%" | Division por cero (falta COALESCE) |
| Fecha aparece como objeto crudo | Helper formatDate no registrado |
| Historial vacio con quizzes existentes | Query mal escrita o user_id incorrecto |
| Veo quizzes de otro usuario | Falta `WHERE q.user_id = $1` en la query |
| Helper formatDate no funciona | No se importa express-handlebars engine correctamente |
| Layout main.hbs no muestra el navbar | Falta `{{> navbar}}` dentro del body |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| res.locals | Variables disponibles automaticamente en todas las vistas |
| FILTER (WHERE ...) en SQL | Agregaciones condicionales (contar X vs Y en una sola query) |
| Subqueries | Calculos intermedios antes de la query final |
| Handlebars helpers | Funciones reutilizables en plantillas (formatDate formatNumber etc) |
| Cohesion de vistas | partials (navbar) que se incluyen en multiples paginas |
| Aislamiento por user | SIEMPRE filtrar por user_id en queries autenticadas |
| Logout por POST | Practica de seguridad vs GET (CSRF) |
| Intl.DateTimeFormat | Formato nativo de fechas internacionalizadas |