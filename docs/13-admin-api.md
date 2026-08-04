# Fase 13: Admin API (Endpoints JSON)

## Objetivo
Crear los endpoints API JSON para que un admin pueda gestionar preguntas via HTTP. Esta fase cubre solo la API (no las vistas HBS que van en la Fase 14). Los endpoints permiten listar crear ver actualizar y eliminar (soft delete) preguntas. **Modelo simplificado**: las preguntas se identifican por `language` (`'javascript'` | `'sql'`), sin `categoryId` ni `difficulty`.

---

### Paso 1: Crear controlador `admin.controller.js` (funciones API)

Que hacer:
Crear `backend/src/controllers/admin.controller.js` con las funciones de la API JSON:

- `apiListQuestions(req, res)`: listar preguntas con filtro opcional por `language`
- `apiCreateQuestion(req, res)`: validar campos calcular hash insertar y devolver JSON
- `apiGetQuestion(req, res)`: obtener una pregunta por id
- `apiUpdateQuestion(req, res)`: actualizar y devolver JSON
- `apiDeleteQuestion(req, res)`: soft delete (marcar `is_active = false`)

Fragmento clave (la formula del hash):
```js
import crypto from 'node:crypto';
const hash = crypto.createHash('md5').update(`${title}${description}`).digest('hex');
```

Pistas:
- Validar campos requeridos: `title`, `description`, `language`, `type`
- El hash es MD5 de `title + description`. Si title o description cambian en update se recalcula.
- Si el hash ya existe en otra pregunta devolver error 409 (conflicto por duplicado).
- Soft delete: `UPDATE questions SET is_active = false WHERE id = $1`. NO hard delete.
- Devolver JSON con status codes correctos: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 409 Conflict.

---

### Paso 2: Crear rutas API de admin

Que hacer:
Crear `backend/src/routes/admin.routes.js` con los endpoints API JSON:

- `GET /api/admin/questions` → `apiListQuestions`
- `POST /api/admin/questions` → `apiCreateQuestion`
- `GET /api/admin/questions/:id` → `apiGetQuestion`
- `PUT /api/admin/questions/:id` → `apiUpdateQuestion`
- `DELETE /api/admin/questions/:id` → `apiDeleteQuestion`

Fragmento clave (montar con doble middleware):
```js
app.use('/api/admin', isAuthenticated, isAdmin, adminApiRoutes);
```

Pistas:
- El doble middleware (`isAuthenticated` + `isAdmin`) garantiza que solo admins accedan.
- Las rutas API iran en `/api/admin/*` (con prefijo `/api`).
- Las rutas de vistas iran en `/admin` (sin prefijo `/api`). Esas van en la Fase 14.
- El orden de las funciones middleware es importante: primero auth luego autorizacion.

---

### Paso 3: Verificar acceso protegido

1. Iniciar el server
2. Sin autenticarse: hacer GET a `/api/admin/questions` con curl
3. Debe responder 401 (sin sesion)
4. Login con usuario normal (no admin): intentar acceder
5. Debe responder 403 (sin permisos)
6. Promover el usuario a admin en BD (via bootstrap env vars)
7. Login de nuevo: intentar acceder
8. Debe responder 200 con la lista de preguntas

Pistas:
- El doble middleware (`isAuthenticated` + `isAdmin`) rechaza ANTES de llegar al controlador.
- En dev `secure: false` permite cookies en http://localhost.

Que estudiar:
- Diferencia entre 401 (no autenticado) y 403 (sin permisos)

---

### Paso 4: Probar flujo CRUD completo

Con curl o Postman probar:
1. `POST /api/admin/questions` con body valido → debe devolver 201 con la pregunta creada
2. `GET /api/admin/questions` → debe incluir la pregunta nueva
3. `GET /api/admin/questions/:id` → debe devolver la pregunta
4. `PUT /api/admin/questions/:id` con cambios → debe devolver 200 con la pregunta actualizada
5. `DELETE /api/admin/questions/:id` → debe devolver 204 (o 200) y la pregunta ya no aparece en el listado

Pistas:
- El body del POST debe incluir: `language`, `type`, `title`, `description`, y los campos según el tipo.
- Status 204 No Content es el standard para DELETE exitoso. Algunos prefieren 200 con body vacio.

---

### Checklist de verificacion

- [ ] `admin.controller.js` con 5 funciones de API
- [ ] `admin.routes.js` con las 5 rutas
- [ ] Middleware `isAuthenticated` + `isAdmin` aplicado
- [ ] GET 401 sin sesion
- [ ] GET 403 con usuario sin role admin
- [ ] GET 200 con admin
- [ ] POST 201 al crear pregunta valida
- [ ] POST 400 con campos faltantes
- [ ] GET 404 con id inexistente
- [ ] PUT 200 al actualizar
- [ ] DELETE 204 al soft delete
- [ ] Pregunta eliminada no aparece en listado (con filtro `language`)

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| REST API CRUD | Convencion universal para gestionar recursos |
| Hash MD5 | Deduplicar preguntas por contenido (title+description) |
| Soft delete | Preservar historial sin perder datos |
| RBAC con middlewares | Separar autenticacion de autorizacion |
| Status codes HTTP | Comunicar correctamente el resultado al cliente |
| Validacion de entrada | Nunca confiar en datos del cliente |
| Filtro por language | Modelo simplificado sin categorías |
