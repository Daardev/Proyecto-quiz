# Fase 4: Auth Module - Google OAuth

## Objetivo
Implementar login con Google para que los usuarios puedan autenticarse. Usaras Passport.js con la estrategia de Google OAuth 2.0 y sesiones del lado servidor (la configuracion del session store externo va en la Fase 6).

---

### Paso 1: Instalar dependencias de auth

Que hacer:
- npm install passport passport-google-oauth20 express-session

Pistas:
- passport es el framework de autenticacion. Soporta mas de 500 estrategias (Google GitHub Facebook local JWT etc).
- passport-google-oauth20 es la estrategia especifica para Google OAuth 2.0. No confundir con passport-google-oauth (version antigua OAuth 1.0).
- express-session maneja sesiones del lado servidor. El store por defecto es memoria.
- `connect-pg-simple` se instala en la Fase 6 cuando configures el session store con Postgres.

Que estudiar:
- Passport.js: que es y como funciona (estrategia serialize deserialize)
- Google OAuth 2.0: flujo de 3 pasos
- express-session: almacenamiento en memoria (Fase 5) vs store externo (Fase 6)

---

### Paso 2: Configurar Google Cloud Console

Que hacer:
1. Ir a Google Cloud Console
2. Crear un proyecto nuevo (o usar uno existente)
3. Ir a APIs and Services Credentials
4. Crear OAuth 2.0 Client ID (tipo Web application)
5. Agregar Authorized redirect URIs: http://localhost:3001/api/auth/google/callback
6. Copiar Client ID y Client Secret al .env

Pistas:
- En desarrollo la URI de redirect debe usar http://localhost (no https). En produccion debe ser HTTPS.
- Google no permite localhost con puerto en algunos casos. Si tienes problemas usa http://127.0.0.1:3001/api/auth/google/callback.
- El Client Secret es sensible. No lo compartas ni lo subas a Git.

Que estudiar:
- Google Cloud Console: OAuth consent screen credentials scopes
- Redirect URIs: por que Google las exige (seguridad)
- Diferencia entre Client ID y Client Secret

---

### Paso 3: Configurar Passport Google Strategy

Que hacer:
Crear src/config/passport.js con:
1. Importar Passport y GoogleStrategy
2. Configurar estrategia con clientID clientSecret callbackURL
3. En la funcion verify:
   - Recibir accessToken refreshToken profile done
   - Buscar usuario por googleId con db.query.users.findFirst()
   - Si no existe crear usuario nuevo con db.insert(users).values(...).returning()
   - Llamar done(null, user) si exito done(error) si falla
4. Configurar serializeUser: guardar user.id en la sesion
5. Configurar deserializeUser: buscar usuario por ID en BD y pasarlo a done

Pistas:
- profile.emails[0].value y profile.displayName son los datos que Google devuelve en el perfil. Revisa la estructura completa con console.log(profile).
- El callback verify es donde decides si el usuario existe o lo creas. No es un middleware Express es un callback interno de Passport.
- serializeUser solo guarda el ID en la sesion (no el objeto completo). Esto mantiene la sesion liviana.
- deserializeUser se ejecuta en cada request que tenga sesion. Hace una query a BD cada vez - considera si necesitas cachearlo.

Que estudiar:
- Passport strategy: que recibe y que debe retornar el callback verify
- serializeUser / deserializeUser - por que se separan
- Google profile structure: emails displayName photos id

---

### Paso 4: Configurar sesion en app.js

Que hacer:
En app.js:
1. Importar session de express-session y passport
2. Agregar middleware de session ANTES de passport (configuracion basica con memoria; la migracion a store Postgres va en la Fase 6):
   - secret: de process.env.SESSION_SECRET
   - resave: false
   - saveUninitialized: false
   - cookie.maxAge: 24 horas en milisegundos
   - cookie.secure: true solo en produccion (usar process.env.NODE_ENV === 'production')
3. Agregar app.use(passport.initialize())
4. Agregar app.use(passport.session())
5. Agregar middleware global para que las vistas Handlebars tengan acceso al usuario actual:
   - `res.locals.user = req.user` (puede ser null si no esta logueado)
   - `res.locals.isAdmin = req.user?.role === 'admin'`
   - Esto debe ir DESPUES de passport.session() para que req.user este disponible

Fragmento clave (session basico con memoria):
```javascript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

Fragmento clave (res.locals):
```javascript
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAdmin = req.user?.role === 'admin';
  next();
});
```

Pistas:
- En esta fase usamos session en memoria (suficiente para desarrollo local). En la Fase 6 migraremos a store Postgres.
- El orden es IMPORTANTE: session luego passport.initialize luego passport.session luego el middleware de res.locals. Si pones passport antes de session no va a encontrar la sesion. Si pones res.locals antes de passport.session, req.user sera siempre null.
- resave: false evita guardar la sesion si no hubo cambios. Mejora performance.
- saveUninitialized: false evita crear sesiones para usuarios no autenticados (GDPR performance).
- secure: false en desarrollo porque no tienes HTTPS. En produccion debe ser true o las cookies no se enviaran.
- `res.locals` es la forma estandar de pasar datos a TODAS las vistas sin tener que incluirlos en cada `res.render()`. El navbar (Fase 12) usa `user` y `isAdmin` de aca.
- El middleware debe ir DESPUES de las rutas que requieren login (como /api/auth/google) pero ANTES de las rutas que renderizan vistas.

Que estudiar:
- express-session options: secret resave saveUninitialized cookie
- Cookie flags: secure httpOnly sameSite - que significa cada uno
- res.locals en Express: variables globales disponibles en vistas Handlebars
- Orden de middlewares: por que el orden importa y como debuggearlo

---

### Paso 5: Crear rutas de auth

Que hacer:
Crear auth.routes.js con:
1. GET /google -> passport.authenticate('google', { scope: ['profile', 'email'] }) redirige a Google
2. GET /google/callback -> passport.authenticate('google', { failureRedirect: '/login?error=true', successRedirect: '/' }) Google redirige aqui despues del login
3. GET /me -> devuelve req.user como JSON si existe o 401 si no
4. POST /logout -> comportamiento dual:
   - Si viene de un form HTML (header `Accept: text/html`): `req.logout(callback)` y `res.redirect('/')`
   - Si viene de fetch/JSON (header `Accept: application/json`): `req.logout(callback)` y `res.json({ success: true })`

Fragmento clave (discriminar entre form y JSON):
```javascript
req.logout((err) => {
  if (err) return next(err);
  if (req.accepts('html')) return res.redirect('/');
  res.json({ success: true });
});
```

Pistas:
- scope define que informacion pides. 'profile' da nombre foto 'email' da email.
- failureRedirect es a donde va el usuario si el login falla. Como aun no tienes pagina de login puedes redirigir a / con un parametro de error.
- req.logout() requiere un callback (Passport 0.7+). Versiones anteriores usaban req.logout() sin callback.
- `req.accepts('html')` retorna truthy si el cliente prefiere HTML (navegadores con forms). Esto permite tener UN solo endpoint que sirva ambos casos.
- El navbar (Fase 10 Paso 7) usa form POST que sera redirigido. Un futuro cliente fetch recibira JSON.
- Montar rutas en app.use('/api/auth', authRoutes).

Que estudiar:
- Passport authenticate() - como middleware opciones
- Google OAuth scope - que datos pides y por que
- req.logout() vs req.session.destroy() - diferencias
- Content negotiation: como Express decide entre HTML y JSON segun headers
- HTTP Accept header: que es y como lo usa req.accepts()

---

### Paso 6: Crear middleware de autenticacion

Que hacer:
Crear `src/middleware/auth.middleware.js`:
1. `isAuthenticated`: si `req.user` existe llama `next()`. Si no responde 401 JSON.
2. `optionalAuth`: en realidad no hace nada solo llama `next()`. Es explicita para indicar que una ruta puede tener o no usuario.

Crear `src/middleware/isAdmin.js` (usado para rutas del dashboard admin):
1. `isAdmin`: si `req.user?.role === 'admin'` llama `next()`. Si no responde 403 con `{ error: 'Acceso restringido a administradores' }`.

Fragmento clave (la condicion):
```javascript
if (req.user?.role !== 'admin') return res.status(403).json({ error: '...' });
```

Pistas:
- Passport agrega req.user AUTOMATICAMENTE si hay una sesion valida. No necesitas hacer nada adicional.
- isAuthenticated tambien se puede escribir con req.isAuthenticated() (metodo que Passport agrega a req).
- optionalAuth sirve mas como documentacion que como funcionalidad. Util para rutas donde el usuario es opcional.
- isAdmin SIEMPRE debe ir DESPUES de isAuthenticated en la cadena de middlewares. Si va solo, req.user sera undefined y siempre dara 403.
- El middleware isAdmin es un patron de "autorizacion" (que puede hacer) vs "autenticacion" (quien es). Separarlos es buena practica.

Que estudiar:
- Middleware pattern: `(req res next) => { ... }`
- req.user req.isAuthenticated() req.logout() - metodos que Passport agrega a req
- Middleware de proteccion vs middleware opcional
- Autenticacion vs autorizacion: que es cada una y por que se separan
- RBAC (Role-Based Access Control): patron de autorizacion basico

---

### Paso 7: Probar flujo completo

Que hacer:
1. Iniciar servidor
2. Abrir http://localhost:3001/api/auth/google en navegador
3. Deberia redirigirte a Google -> pedir login -> redirigir de vuelta a /
4. Probar GET /api/auth/me - debe devolver tus datos
5. Probar POST /api/auth/logout - debe cerrar sesion
6. Verificar que despues de logout /api/auth/me devuelve 401

Pistas:
- Si Google muestra Error: redirect_uri_mismatch el URI en Google Console no coincide exactamente con el callbackURL de Passport.
- Si despues del login te redirige a /login?error=true algo fallo en el callback (revisar logs del servidor).
- Las cookies de sesion expiran despues de 24h (configurable). Si cierras el navegador y vuelves la sesion deberia persistir (depende de cookie config).

Que estudiar:
- Flujo OAuth completo: navegador -> Google -> callback -> sesion
- Debugging OAuth: como ver errores de Google (consulta logs network tab)

---

## Checklist de verificacion

- [ ] Google Cloud Console configurado con redirect URI correcto
- [ ] /api/auth/google redirige a Google
- [ ] Login con Google exitoso redirige de vuelta
- [ ] /api/auth/me devuelve usuario autenticado
- [ ] /api/auth/logout cierra sesion
- [ ] Rutas protegidas con isAuthenticated devuelven 401 sin sesion

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| redirect_uri_mismatch | URI en Google Console no coincide |
| Error 500 en callback | Fallo en deserializeUser |
| req.user es undefined | Session no configurada |
| Sesion no persiste | cookie sin maxAge |
| Google no acepta localhost | Usa 127.0.0.1 en vez de localhost |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Passport.js | Framework de autenticacion mas usado en Node |
| OAuth 2.0 | Estandar de autenticacion delegada |
| Session cookies | Persistencia de login entre requests |
| serialize / deserialize | Puente entre sesion y datos de usuario |
| Middleware de proteccion | Control de acceso a rutas |