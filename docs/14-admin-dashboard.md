# Fase 14: Admin Dashboard (Vistas HBS)

## Objetivo
Crear las vistas Handlebars para el dashboard admin: lista de preguntas y formulario de crear/editar. Las vistas usan los datos de la BD y los form submits invocan los endpoints del Fase 13. **Modelo simplificado**: las vistas solo filtran por `language`, sin categorías ni dificultad.

---

### Paso 1: Crear rutas admin para vistas

Que hacer:
Modificar `backend/src/routes/admin.routes.js` para agregar las rutas de vistas (sin prefijo `/api`):

- `GET /admin` → `getDashboard`
- `GET /admin/new` → `getNewQuestionForm`
- `GET /admin/:id/edit` → `getEditQuestionForm`
- `POST /admin` → `postCreateQuestion`
- `POST /admin/:id` → `postUpdateQuestion`
- `POST /admin/:id/delete` → `postDeleteQuestion`

Fragmento clave (montar rutas):
```js
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);
```

Pistas:
- Por que `/admin` y `/api/admin` separados? El primero es para humanos (form submits navegan). El segundo es para AJAX (Fase 13).
- Un form POST en `/admin` debe terminar con `res.redirect('/admin')` (PRG pattern: Post/Redirect/Get). Esto evita el warning de "re-submit form" del navegador.
- Las vistas usan HBS asi que los forms envian a rutas `/admin` (no `/api/admin`).

---

### Paso 2: Agregar funciones de vistas al controlador admin

En `admin.controller.js` agregar las funciones para vistas:

- `getDashboard(req, res)`: listar preguntas con filtro opcional `?language=X` via query params, renderizar `dashboard.hbs`
- `getNewQuestionForm(req, res)`: renderizar `question-form.hbs` con form vacio
- `getEditQuestionForm(req, res)`: cargar pregunta por id y renderizar `question-form.hbs` con datos
- `postCreateQuestion(req, res)`: validar campos, insertar y `res.redirect('/admin')`
- `postUpdateQuestion(req, res)`: validar campos, actualizar y `res.redirect('/admin')`
- `postDeleteQuestion(req, res)`: soft delete y `res.redirect('/admin')`

Fragmento clave (PRG pattern):
```js
res.redirect('/admin');
```

Pistas:
- El controller recibe datos del form en `req.body` (gracias a `express.urlencoded()`).
- `res.redirect` es mejor que `res.render` despues de un POST (PRG pattern).
- Si la validacion falla: `res.status(400).render('pages/admin/question-form', { error: '...', values: req.body })`.
- `testsTemplate` viene como string JSON del form. Hay que parsearlo con `JSON.parse(req.body.testsTemplate)`.

---

### Paso 3: Crear vista `dashboard.hbs`

Crear `backend/src/views/pages/dashboard.hbs`:
1. Extiende layout `main.hbs`
2. Incluye `{{> navbar}}`
3. Header con titulo "Dashboard admin" y boton "+ Nueva pregunta" que va a `/admin/new`
4. Filtros (form GET): lenguaje — al submit recarga la pagina con query params
5. Tabla de preguntas con columnas: Titulo, Tipo, Lenguaje, Acciones (Editar, Eliminar)

Fragmento clave (la tabla con el boton eliminar):
```handlebars
<form action="/admin/{{this.id}}/delete" method="POST" style="display:inline"
      onsubmit="return confirm('¿Eliminar esta pregunta?')">
  <button type="submit" class="secondary">Eliminar</button>
</form>
```

Pistas:
- Los filtros son un form GET. Al submit se recarga `/admin?language=X`.
- El boton Eliminar es un form POST separado (no un link GET). El `confirm()` en JS pide confirmacion antes de enviar.
- Las preguntas se pasan como array, los lenguajes como lista distinta.

---

### Paso 4: Crear vista `admin/question-form.hbs`

Crear `backend/src/views/pages/admin/question-form.hbs`:
1. Form que sirve tanto para crear como para editar (el action cambia)
2. Campos: Tipo (radio: code/MC), Lenguaje (select), Titulo, Descripcion
3. Si es code: Codigo inicial (textarea), Tests (textarea JSON)
4. Si es MC: opciones (lista con radios para marcar la correcta)

Fragmento clave (el action dinamico):
```handlebars
<form action="{{#if question}}/admin/{{question.id}}{{else}}/admin{{/if}}" method="POST">
```

Pistas:
- Si `question` existe en el contexto: es edicion. El action va a `/admin/:id`.
- Si no existe: es creacion. El action va a `/admin`.
- Los valores de los campos se llenan con `value="{{question.title}}"` (HTML escapado por Handlebars).

---

### Paso 5: Probar flujo completo

1. Login como admin
2. Ir a `/admin` -> ver lista de preguntas
3. Click "+ Nueva pregunta" -> llenar el form -> guardar -> vuelve a la lista con la nueva pregunta
4. Click "Editar" en una pregunta -> modificar -> guardar -> vuelve a la lista
5. Click "Eliminar" -> confirma -> la pregunta desaparece de la lista
6. Logout -> intentar ir a `/admin` -> redirige a login

---

### Checklist de verificacion

- [ ] Rutas admin para vistas montadas con isAuthenticated + isAdmin
- [ ] 6 funciones de vistas en admin.controller.js
- [ ] `dashboard.hbs` renderiza lista con tabla y filtros por lenguaje
- [ ] `question-form.hbs` sirve para crear y editar
- [ ] Form POST redirige a `/admin` despues de crear/actualizar/eliminar
- [ ] Confirm JS aparece antes de eliminar
- [ ] Valores pre-rellenados en form de edicion
- [ ] Errores se muestran en el form

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| PRG pattern | Evita re-submit accidental de forms |
| Mismo form para crear/editar | Patron DRY (no repetir HTML) |
| Confirm JS | UX antes de acciones destructivas |
| Query params en filtros | Mantener estado entre requests |
| Renderizado condicional | `{{#if question}}` distingue crear de editar |
| Filtro por lenguaje | Modelo simplificado sin categorias |
