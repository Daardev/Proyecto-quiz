# Fase 5: Auth Module - Username + Password

## Objetivo
Implementar registro y login con username + password usando bcrypt para hashear credenciales y sesiones propias (express-session + cookie en memoria) para mantener al usuario autenticado entre requests. La migración a session store Postgres se hace en la Fase 6.

---

### Paso 1: Instalar dependencias de auth

Que hacer:
- `npm install bcrypt express-session`

> **Nota**: Aunque `connect-pg-simple` aparece en `package.json` desde esta fase, **no se configura en `app.js` todavia**. Aqui usamos el store por defecto (en memoria). El switch a Postgres es la Fase 6.

Pistas:
- `bcrypt` hashea passwords con salting automatico. 10 rounds es el balance entre seguridad y performance para apps pequeñas/medianas.
- `express-session` maneja sesiones del lado servidor. El store por defecto es memoria (suficiente para desarrollo).
- `connect-pg-simple` se configura en la Fase 6 (migración a session store Postgres).
- No usamos Passport ni OAuth. La logica de auth vive en `auth.service.js` y se monta con un middleware custom en `app.js`.

Que estudiar:
- bcrypt: como funciona el salting, rounds, comparacion de hashes
- express-session: almacenamiento en memoria vs store externo (Fase 6)
- Cookies de sesion: secure httpOnly sameSite

---

### Paso 2: Diseno de la tabla `users`

Que hacer:
La tabla `users` ya esta definida en la Fase 3. Verificar que tenga los campos:

```sql
users: id, username (unique), email (unique), name (default ''), password_hash, role (default 'user'), created_at
```

Validaciones en el controller:
- `username`: 3-30 chars, regex `^[a-zA-Z0-9_]+$`
- `email`: formato valido (regex simple)
- `password`: minimo 8 chars
- `name`: opcional (default = username)

Pistas:
- `username` y `email` son UNIQUE en BD. Las inserciones duplicadas fallan con error 23505 de Postgres.
- `password_hash` es varchar(255) para acomodar el output de bcrypt (60 chars normalmente pero预留 margen).
- `name` puede ser vacio al inicio; el usuario lo llena despues si quiere.

Que estudiar:
- Constraints UNIQUE y manejo de errores de duplicacion
- Validacion de inputs en backend (nunca confiar en el cliente)

---

### Paso 3: Crear `auth.service.js`

Que hacer:
Crear `src/services/auth.service.js` con las funciones core:

1. `hashPassword(password)` - retorna bcrypt hash con 10 rounds
2. `verifyPassword(password, hash)` - bcrypt.compare
3. `findUserByUsername(username)` - query
4. `findUserByEmail(email)` - query
5. `findUserById(id)` - query
6. `createUser({ username, email, name, password, role })` - hashea password e inserta
7. `sanitizeUser(user)` - quita `passwordHash` del objeto retornado
8. `bootstrapAdmin()` - crea o promueve admin si `ADMIN_USERNAME`/`ADMIN_PASSWORD` estan en `.env`

Fragmento clave (la unica linea especifica):
```js
const passwordHash = await bcrypt.hash(password, 10);
```

Pistas:
- `sanitizeUser` es fundamental: nunca devolver `passwordHash` al cliente, ni siquiera encriptado.
- `bootstrapAdmin` se llama una sola vez al arrancar el server. Si el admin ya existe, lo promueve a `role='admin'` si no lo es.
- Si `ADMIN_USERNAME` o `ADMIN_PASSWORD` no estan en `.env`, bootstrap no hace nada (loggea mensaje).
- El bootstrap es async. No bloquea el arranque del server (puede terminar despues de que `app.listen` corra).

Que estudiar:
- Patron Service: separar logica de negocio de HTTP
- Async/await con Drizzle queries
- Patron Bootstrap: inicializacion idempotente al arranque

---

### Paso 4: Crear `auth.controller.js`

Que hacer:
Crear `src/controllers/auth.controller.js` con las 4 funciones HTTP. **Importante**: cada funcion debe discriminar si el cliente quiere HTML o JSON usando `req.accepts(['html', 'json']) === 'html'`. Esto es porque los formularios de `login.hbs` y `register.hbs` (Fase 10) hacen POST normal al mismo endpoint, no fetch.

1. `register(req, res)`:
   - Valida username/email/password (regex)
   - Verifica que username y email no existan (409 si duplicado)
   - Crea usuario via `auth.service.createUser`
   - Establece `req.session.userId` (auto-login)
   - **HTML**: redirect a `postLoginRedirect(user, req)` (ver sub-sección Helper)
   - **JSON**: retorna 201 con `{ user }` (sanitizado)

2. `login(req, res)`:
   - Recibe `{ username, password }`
   - Busca usuario por username
   - Verifica password con bcrypt
   - Si OK: establece sesion y:
     - **HTML**: redirect a `postLoginRedirect(user, req)`
     - **JSON**: retorna 200 con `{ user }` (sanitizado)
   - Si falla: error generico (no decir si es user o password) — renderiza `login.hbs` con error **o** retorna 401 JSON

3. `logout(req, res)`:
   - `req.session.destroy()` + `res.clearCookie('connect.sid')`
   - **HTML**: redirect a `/`
   - **JSON**: `{ success: true }`

4. `me(req, res)`:
   - Si `req.user` existe, retorna `{ user }` (200)
   - Si no, retorna 401 JSON

Fragmento clave (discriminar entre form y JSON):
```js
const wantsHtml = req.accepts(['html', 'json']) === 'html';

if (wantsHtml) {
  return res.redirect(postLoginRedirect(user, req));
}
res.status(201).json({ user });
```

Fragmento clave (logout):
```js
req.session.destroy(() => {
  res.clearCookie('connect.sid');
  if (req.accepts('html')) return res.redirect('/');
  res.json({ success: true });
});
```

Pistas:
- En login, el mensaje de error es siempre generico ("credenciales invalidas") para no exponer cual campo fallo.
- `req.session.userId` se setea en login/register. El middleware global en `app.js` lee ese ID y carga `req.user`.
- El controller de register SIEMPRE setea la sesion (auto-login despues de registrar). Asi el usuario no tiene que loguearse dos veces.
- Renderizar `login.hbs`/`register.hbs` desde el controller es un workaround pragmatic para no tener endpoints separados (form POST vs API JSON). Las vistas usan `res.render()` con `{ error, values }`.

Que estudiar:
- Discriminacion de contenido: `req.accepts(['html', 'json'])`
- `req.accepts` retorna el tipo preferido (en orden de preferencia); si el cliente manda `Accept: text/html` lo agarra
- Status codes correctos: 201 (created), 200 (ok), 400 (validation), 401 (credenciales), 409 (duplicado)
- Auto-login post-register: patron UX comun
- Progressive enhancement: forms funcionan sin JS, JS los mejora con fetch

---

#### Sub-sección: Helper `postLoginRedirect(user, req)`

Que hacer:
Crear un helper en `auth.controller.js` que decida a donde redirigir tras un login/register exitoso, en funcion del `role` del usuario y un parametro `?redirect=` opcional.

```js
function postLoginRedirect(user, req) {
  const explicit = typeof req.body?.redirect === 'string' && req.body.redirect.startsWith('/') ? req.body.redirect : null;
  if (explicit) return explicit;
  if (user.role === 'admin') return '/admin';
  return '/';
}
```

Pistas:
- `req.body.redirect` viene de un input hidden en `login.hbs` que se llena desde `?redirect=` en la URL (ej: si el usuario intenta acceder a `/profile` sin estar logueado, el middleware lo manda a `/login?redirect=/profile`, y el form rellena el hidden).
- Validar que `redirect` empieza con `/` evita open redirects: `redirect=https://evil.com` seria un ataque.
- Admin va a `/admin` por defecto; usuario normal va a `/`.
- Si `redirect` es vacio o no es string, cae al default por role.

Que estudiar:
- Open redirect attacks: por que validar prefijo `/`
- Query string preservation en redirects: `encodeURIComponent` en el emisor, `decodeURIComponent` en el receptor (en este caso no se decodifica porque solo se valida el path)

---

### Paso 5: Crear `auth.routes.js`

Que hacer:
Crear `src/routes/auth.routes.js` con los 4 endpoints:

```js
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/logout', authCtrl.logout);
router.get('/me', authCtrl.me);
```

Pistas:
- Las rutas se montan en `app.use('/api/auth', authRoutes)`.
- Los endpoints `/register` y `/login` son PUBLICOS. `/logout` puede ser publico (si no hay sesion destruye igual). `/me` requiere sesion valida pero no falla con 401 explicitamente — el middleware global setea `req.user = null` y el controller lo maneja.

Que estudiar:
- Express Router: composicion modular de rutas
- Rutas publicas vs protegidas

---

### Paso 6: Configurar sesion y middleware en `app.js`

Que hacer:
En `app.js`:

1. Importar `session` de `express-session`
2. Configurar `app.use(session({...}))` ANTES del middleware de auth (secret, resave, saveUninitialized, cookie). **Store en memoria por defecto** — la migración a Postgres es la Fase 6.
3. Agregar middleware global DESPUES de session que:
   - Lee `req.session.userId`
   - Si existe: busca user en BD, setea `req.user` (sanitizado)
   - Si no existe: `req.user = null`
   - Setea `res.locals.user` y `res.locals.isAdmin`
4. Llamar `bootstrapAdmin()` al inicio del archivo (no bloquea el listen) — ver Fase 1 sub-sección "`bootstrapAdmin()`"
5. Montar `app.use('/api/auth', authRoutes)`

Fragmento clave (configuracion basica):
```js
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-replace-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

> **Importante**: NO uses `connect-pg-simple` aqui. Este paso es solo `express-session` con store en memoria. El switch a Postgres store (con `pool` compartido de `config/database.js`) es la **Fase 6**.

Fragmento clave (middleware custom que reemplaza a Passport):
```js
app.use(async (req, res, next) => {
  try {
    if (req.session?.userId) {
      const user = await findUserById(req.session.userId);
      req.user = user ? sanitizeUser(user) : null;
      if (!user) req.session.userId = null;
    } else {
      req.user = null;
    }
    res.locals.user = req.user;
    res.locals.isAdmin = req.user?.role === 'admin';
    next();
  } catch (err) {
    next(err);
  }
});
```

Pistas:
- El orden es CRITICO: session → middleware de carga de user → rutas. Si pones el middleware antes de session, `req.session` no existe.
- `secure: process.env.NODE_ENV === 'production'` — en desarrollo (HTTP) la cookie se envia; en produccion (HTTPS) se requiere secure.
- El middleware es async porque la query a BD lo es. Express 5 soporta middlewares async con try/catch.
- `req.user` se setea en CADA request (no solo en login). Esto permite que el navbar (Fase 10) siempre sepa si hay usuario logueado.
- El middleware NO rechaza requests sin auth (eso lo hace `isAuthenticated` despues).
- Store en memoria tiene una limitación: cada restart del server borra todas las sesiones. No apto para Vercel serverless (Fase 6 lo arregla).

Que estudiar:
- Middlewares async en Express 5
- Patron de "cargar usuario en cada request" (vs Passport que lo hace automaticamente)
- Orden de middlewares y debugging
- Diferencia entre session store en memoria vs persistente (Fase 6)

---

### Paso 7: Crear middleware `auth.middleware.js`

Que hacer:
Crear `src/middleware/auth.middleware.js`. Misma discriminacion HTML/JSON que el controller: cuando el cliente quiere HTML, redirigir a `/login?redirect=<originalUrl>` en vez de devolver 401 JSON.

```js
export function isAuthenticated(req, res, next) {
  if (req.user) return next();
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    const redirect = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/login?redirect=${redirect}`);
  }
  res.status(401).json({ error: 'no autenticado' });
}

export function isAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    return res.status(403).render('pages/index', {
      technologies: [],
      error: 'Acceso restringido a administradores',
    });
  }
  res.status(403).json({ error: 'acceso restringido a administradores' });
}

export function optionalAuth(req, res, next) {
  next();
}
```

Pistas:
- `isAuthenticated` SIEMPRE va antes de cualquier ruta protegida. Sin el, `req.user` no existe.
- `isAdmin` SIEMPRE va DESPUES de `isAuthenticated`. Si va solo, `req.user` es undefined y siempre rechaza con 403.
- `optionalAuth` es solo documentacion: indica que la ruta puede tener o no usuario. No hace nada.
- El redirect a `/login?redirect=` preserva la URL original para que tras login el usuario vuelva a donde queria ir. El helper `postLoginRedirect` de la sub-sección "Helper `postLoginRedirect`" consume ese parametro.
- `encodeURIComponent` evita que la URL original rompa el query string del redirect.
- Renderizar `pages/index` con error en el caso de admin-denied es para mostrar el error en el contexto de la UI (sin redirigir a una URL que el usuario no solicito).

Que estudiar:
- Patron de middleware en cadena
- Autenticacion (quien es) vs autorizacion (que puede hacer)
- RBAC basico con Express
- UX de redirects preservados: `?redirect=` en login

---

### Paso 8: Probar el flujo completo con curl

Que hacer:
1. Iniciar el server (`npm run dev`)
2. Verificar que el bootstrap creo el admin (ver logs)
3. Probar register:
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","email":"alice@x.com","password":"alicepass"}'
   ```
4. Probar login (admin):
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -c cookies.txt \
     -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
   ```
5. Probar me (con cookie):
   ```bash
   curl http://localhost:3001/api/auth/me -b cookies.txt
   ```
6. Probar logout:
   ```bash
   curl -X POST http://localhost:3001/api/auth/logout -b cookies.txt -c cookies.txt
   ```
7. Verificar que despues de logout `/me` devuelve 401

Errores comunes:
- 401 en /me: el cookie no se esta enviando (verifica `-b cookies.txt`)
- "credenciales invalidas" en login: password incorrecto o usuario no existe
- 409 en register: username o email duplicado

Que estudiar:
- Testing de APIs con curl
- Manejo de cookies con `-b` y `-c` flags

---

### Paso 9: Verificar discriminador HTML/JSON en auth

Que hacer:
Probar el mismo endpoint con dos clientes diferentes para confirmar que la discriminacion funciona:

**Test 1: cliente que quiere HTML (navegador)**
1. Iniciar el server (`npm run dev`)
2. Abrir `http://localhost:3001/login` en el navegador
3. Llenar el form con credenciales de admin y submitear
4. Esperar: redirect a `/admin` (porque el admin tiene `role='admin'`, ver `postLoginRedirect`)

**Test 2: cliente que quiere JSON (curl)**
1. Probar login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```
2. Esperar: 200 con `{ user: { ..., role: 'admin' } }` (sin redirect)
3. Probar `me` con la cookie:
```bash
curl http://localhost:3001/api/auth/me -b cookies.txt
```
4. Esperar: 200 con `user.role === 'admin'`

**Test 3: cliente HTML intenta acceder a ruta protegida sin login**
1. Abrir `http://localhost:3001/admin` en el navegador (sin estar logueado)
2. Esperar: redirect a `/login?redirect=%2Fadmin`

Pistas:
- El discriminador `req.accepts(['html', 'json'])` confía en el header `Accept` que el cliente envía. Los navegadores siempre mandan `Accept: text/html,...` por defecto; curl sin `-H 'Accept: ...'` no manda Accept, asi que `req.accepts` puede retornar `false` o el primer tipo disponible (depende de la versión de Express).
- Si curl no devuelve lo esperado, agregar `-H 'Accept: application/json'` para forzar JSON.
- El navbar (Fase 10) muestra "Admin" en el menu solo si `res.locals.isAdmin` es true.
- Para acceder a `/admin` (Fase 14) el usuario debe estar logueado Y tener role='admin'.

Que estudiar:
- Flujo de autorizacion completo: login → sesion → middleware → navbar/ruta protegida
- Content negotiation: como Express decide entre HTML y JSON
- `req.accepts` vs `req.is()`: el primero prefiere, el segundo verifica

---

## Checklist de verificacion

- [ ] `bcrypt` y `express-session` instalados
- [ ] `auth.service.js` con 8 funciones (hash, verify, find*, create, sanitize, bootstrap)
- [ ] `auth.controller.js` con 4 funciones HTTP (register, login, logout, me)
- [ ] `auth.routes.js` con 4 endpoints
- [ ] `auth.middleware.js` con `isAuthenticated`, `isAdmin`, `optionalAuth`
- [ ] `app.js` configura session + middleware custom de carga de user + `bootstrapAdmin()`
- [ ] `/api/auth/register` crea usuario con password hasheado
- [ ] `/api/auth/login` verifica password y crea sesion (cookie)
- [ ] `/api/auth/me` lee sesion y devuelve usuario
- [ ] `/api/auth/logout` destruye sesion y limpia cookie
- [ ] Admin bootstrap funciona si `ADMIN_USERNAME`/`ADMIN_PASSWORD` en `.env`
- [ ] Sesion persiste entre requests (cookie)
- [ ] Password nunca se expone en respuestas JSON

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Login retorna 401 con password correcto | `bcrypt.compare` falla por mismatch de rounds o encoding |
| Sesion no persiste entre requests | Cookie no se envia (sin `-b cookies.txt` en curl) o `secure: true` en dev (HTTP) |
| 401 en /me con sesion valida | El middleware de carga de user no se ejecuto o `req.session.userId` es undefined |
| Bootstrap admin no se crea | `ADMIN_USERNAME` o `ADMIN_PASSWORD` no estan en `.env` |
| Register retorna 409 inmediato | Username o email ya registrados (unique constraint) |
| `req.user` siempre undefined | session middleware no se configuro o esta en orden incorrecto |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| bcrypt | Hashing de passwords con salting y rounds ajustables |
| express-session | Sesiones con cookie firmadas (express-session crea la cookie `connect.sid`) |
| Middleware custom de carga de user | Reemplaza a Passport: simple, sin dependencias extra |
| Bootstrap admin | Inicializacion idempotente al arranque |
| Auto-login post-register | Patron UX para evitar doble paso |
| Sanitizacion de user | Nunca exponer `passwordHash` al cliente |
