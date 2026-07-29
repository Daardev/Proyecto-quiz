# Fase 14: Admin Dashboard (Vistas HBS)

## Objetivo
Crear las vistas Handlebars para el dashboard admin: lista de preguntas y formulario de crear/editar. Las vistas usan los datos de la API (Fase 13) y los form submits invocan los endpoints.

---

### Paso 1: Crear rutas admin para vistas

Que hacer:
Modificar `backend/src/routes/admin.routes.js` para agregar las rutas de vistas (sin prefijo `/api`):

- `GET /admin` -> `getDashboard`
- `GET /admin/new` -> `getNewQuestionForm`
- `GET /admin/:id/edit` -> `getEditQuestionForm`
- `POST /admin` -> `postCreateQuestion`
- `POST /admin/:id` -> `postUpdateQuestion`
- `POST /admin/:id/delete` -> `postDeleteQuestion`

Fragmento clave (montar rutas):
```javascript
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);
```

Pistas:
- Por que `/admin` y `/api/admin` separados? El primero es para humanos (form submits navegan). El segundo es para AJAX (Fase 13).
- Un form POST en `/admin` debe terminar con `res.redirect('/admin')` (PRG pattern: Post/Redirect/Get). Esto evita el warning de "re-submit form" del navegador.
- Las vistas usan HBS asi que los forms envian a rutas `/admin` (no `/api/admin`).
- `isAdmin` se aplica en TODAS las rutas dentro de este router. Sin esto cualquier usuario autenticado podria acceder.

Que estudiar:
- PRG pattern: por que redirigir despues de un POST
- Separacion de rutas: HTML form submits vs fetch/JSON
- Middleware chaining: como aplicar multiples middlewares en un router

---

### Paso 2: Agregar funciones de vistas al controlador admin

Que hacer:
En `admin.controller.js` (creado en Fase 13) agregar las funciones para vistas:

- `getDashboard(req, res)`: listar preguntas con filtros via query params renderizar `dashboard.hbs`
- `getNewQuestionForm(req, res)`: renderizar `question-form.hbs` con form vacio
- `getEditQuestionForm(req, res)`: cargar pregunta por id y renderizar `question-form.hbs` con datos
- `postCreateQuestion(req, res)`: validar campos insertar y `res.redirect('/admin')`
- `postUpdateQuestion(req, res)`: validar campos actualizar y `res.redirect('/admin')`
- `postDeleteQuestion(req, res)`: soft delete y `res.redirect('/admin')`

Fragmento clave (PRG pattern):
```javascript
res.redirect('/admin');
```

Pistas:
- El controller recibe datos del form en `req.body` (gracias a `express.urlencoded()` configurado en Fase 1).
- `res.redirect` es mejor que `res.render` despues de un POST (PRG pattern).
- Si la validacion falla: `res.status(400).render('admin/question-form', { error: '...', values: req.body })`.
- `testsTemplate` viene como string JSON del form. Hay que parsearlo con `JSON.parse(req.body.testsTemplate)`.
- `hash` se calcula con crypto MD5 de `title + description` antes de insertar.

Que estudiar:
- PRG pattern: por que es importante
- Validacion server-side: que pasa si el cliente deshabilita JS
- JSON.parse y try/catch: manejo de errores de parseo

---

### Paso 3: Crear vista dashboard.hbs

Que hacer:
Crear `backend/src/views/pages/dashboard.hbs`:
1. Extiende layout `main.hbs`
2. Incluye `{{> navbar}}`
3. Header con titulo "Dashboard Admin" y boton "+ Nueva pregunta" que va a `/admin/new`
4. Filtros (form GET): tecnologia categoria dificultad — al submit recarga la pagina con query params
5. Tabla de preguntas con columnas:
   - Titulo
   - Tecnologia
   - Categoria
   - Dificultad
   - Acciones: Editar (`/admin/:id/edit`) Eliminar (form POST a `/admin/:id/delete` con confirm JS)

Fragmento clave (la tabla con el boton eliminar):
```handlebars
<form action="/admin/{{this.id}}/delete" method="POST" style="display:inline"
      onsubmit="return confirm('Eliminar esta pregunta?')">
  <button type="submit">Eliminar</button>
</form>
```

Pistas:
- El navbar se incluye con `{{> navbar}}` (creado en Fase 12). Como el admin esta logueado vera "Mi perfil" + "Admin".
- Los filtros son un form GET. Al submit se recarga `/admin?technology=X&category=Y&difficulty=Z`.
- El boton Eliminar es un form POST separado (no un link GET). El `confirm()` en JS pide confirmacion antes de enviar.
- Las tecnologias y categorias se pasan al render desde el controlador. Las preguntas se pasan como array.
- Si no hay preguntas: mostrar mensaje "No hay preguntas. Crea la primera."

Que estudiar:
- Form GET vs POST: cuando usar cada uno
- CSRF: por que los forms POST son mas seguros
- `onsubmit="return confirm(...)"`: confirmacion nativa del navegador

---

### Paso 4: Crear vista admin/question-form.hbs

Que hacer:
Crear `backend/src/views/pages/admin/question-form.hbs`:
1. Extiende layout `main.hbs` + incluye navbar
2. Form que sirve tanto para crear como para editar (el action cambia)
3. Campos:
   - Tecnologia (select con tecnologias)
   - Categoria (select con categorias)
   - Dificultad (select: 1 facil 2 medio 3 dificil)
   - Titulo (input text)
   - Descripcion (textarea)
   - Starter code (textarea)
   - Tests template (textarea donde se pega el JSON)
   - Boton Guardar / Actualizar

Fragmento clave (el action dinamico):
```handlebars
<form action="{{#if question}}/admin/{{question.id}}{{else}}/admin{{/if}}" method="POST">
```

Pistas:
- Si `question` existe en el contexto: es edicion. El action va a `/admin/:id`.
- Si no existe: es creacion. El action va a `/admin`.
- Los valores de los campos se llenan con `value="{{question.title}}"` (HTML escapado por Handlebars).
- Si hay error de validacion: el controlador pasa `{ error: 'mensaje', values: req.body }` y la vista muestra `<p class="error">{{error}}</p>`.
- El campo `testsTemplate` requiere JSON valido. Un `<textarea>` es suficiente para empezar.

Que estudiar:
- Form reutilizable para crear/editar: patron DRY
- Pre-rellenar formularios con valores: que pasa si vienen del POST anterior
- Validacion HTML5: `required` `minlength` `pattern`

---

### Paso 5: Probar flujo completo

Que hacer:
1. Login como admin
2. Ir a `/admin` -> ver lista de preguntas (puede estar vacia)
3. Click "+ Nueva pregunta" -> llenar el form -> guardar -> vuelve a la lista con la nueva pregunta
4. Click "Editar" en una pregunta -> modificar -> guardar -> vuelve a la lista
5. Click "Eliminar" -> confirma -> la pregunta desaparece de la lista
6. Logout -> intentar ir a `/admin` -> redirige a login
7. Login con usuario sin role admin -> intentar `/admin` -> 403

Errores comunes:
- Boton Eliminar no hace nada: el `confirm()` retorna false y se cancela el submit.
- Form envia datos vacios: agregar `required` a los inputs en el HTML.
- JSON invalido en testsTemplate: agregar try/catch en el controlador y devolver error 400.

Pistas:
- El navbar debe mostrar "Admin" solo si `isAdmin` es true (configurado en Fase 5 con `res.locals`).
- Si el form de edicion no pre-rellena los valores, el contexto `question` no se esta pasando al render.

Que estudiar:
- Debugging de formularios HTML
- Patron PRG completo
- Validacion visual de errores

---

## Checklist de verificacion

- [ ] Rutas admin para vistas montadas con isAuthenticated + isAdmin
- [ ] 6 funciones de vistas en admin.controller.js
- [ ] `dashboard.hbs` renderiza lista con tabla y filtros
- [ ] `question-form.hbs` sirve para crear y editar
- [ ] Form POST redirige a `/admin` despues de crear/actualizar/eliminar
- [ ] Confirm JS aparece antes de eliminar
- [ ] Valores pre-rellenados en form de edicion
- [ ] Errores se muestran en el form

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 404 en /admin | Router no montado en app.js |
| 403 siempre | isAdmin aplicado sin isAuthenticated antes |
| Form no redirige | Falta `res.redirect('/admin')` (PRG pattern) |
| Valores no pre-rellenan | Contexto `question` no se pasa al render |
| Filter no funciona | Query params no se leen correctamente |
| Confirm no aparece | onsubmit con sintaxis incorrecta |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| PRG pattern | Evita re-submit accidental de forms |
| Mismo form para crear/editar | Patron DRY (no repetir HTML) |
| Confirm JS | UX antes de acciones destructivas |
| Query params en filtros | Mantener estado entre requests |
| Renderizado condicional | `{{#if question}}` distingue crear de editar |