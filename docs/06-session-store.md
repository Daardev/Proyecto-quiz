# Fase 6: Session Store Externo

## Objetivo
Migrar las sesiones de memoria a PostgreSQL usando `connect-pg-simple`. Esto es requerido porque Vercel Functions es serverless: cada request va a una instancia distinta del server, perdiendo la sesion en memoria.

---

### Paso 1: Instalar connect-pg-simple

Que hacer:
- `npm install connect-pg-simple`

Pistas:
- `connect-pg-simple` es el adaptador para guardar sesiones en PostgreSQL.
- Es un complemento de `express-session` (que ya instalaste en la Fase 5).
- Funciona con cualquier BD Postgres (Neon, Supabase, RDS).
- La tabla `session` ya fue definida en la Fase 3 (schema de BD).

Que estudiar:
- Session stores: por que no siempre se usa memoria
- connect-pg-simple vs connect-redis: cuando usar cada uno
- Serverless y sesiones: por que la memoria no funciona

---

### Paso 2: Configurar session store en app.js

Que hacer:
En `app.js` reemplazar la configuracion de sesion actual (sin store externo) por la nueva version con `connect-pg-simple`.

Fragmento clave (la nueva configuracion):
```javascript
import session from 'express-session';
import { Pool } from 'pg';
import PgStore from 'connect-pg-simple';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PgSessionStore = PgStore(session);

app.use(session({
  store: new PgSessionStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

Pistas:
- **Por que session store externo?** En DESARROLLO la memoria funciona (un solo proceso). En VERCEL FUNCTIONS cada request va a una instancia distinta del server, perdiendo la sesion. `connect-pg-simple` guarda sesiones en la misma BD Neon.
- `createTableIfMissing: true` permite que connect-pg-simple cree la tabla automaticamente si no existe. Aun asi la Fase 3 la define en el schema para tener control.
- El `pool` puede ser el mismo que creaste en Fase 3 (`config/database.js`). Reutilizar evita conexiones duplicadas.
- El orden sigue siendo: session → middleware custom de carga de user → middleware res.locals.
- secure: false en desarrollo porque no tienes HTTPS. En produccion debe ser true.

Que estudiar:
- Como funciona un session store en PostgreSQL
- Trade-offs: memoria vs Redis vs Postgres
- Ciclo de vida de una sesion HTTP

---

### Paso 3: Verificar que la tabla session existe

Que hacer:
1. Conectarte a Neon y verificar que la tabla `session` existe:
   ```sql
   SELECT * FROM session LIMIT 1;
   ```
2. Si no existe, las migraciones no se aplicaron. Volver a Fase 3 y correr `npx drizzle-kit migrate`.
3. Iniciar el server y probar login.
4. Verificar que se crea una fila en `session` despues del login:
   ```sql
   SELECT sid, expire FROM session;
   ```

Pistas:
- La tabla `session` tiene columnas: `sid` (PK) `sess` (json con datos de sesion) `expire` (timestamp).
- Cada vez que un usuario se loguea se crea una nueva fila.
- Cuando el usuario hace logout la fila se elimina.
- Las sesiones expiran segun `cookie.maxAge`. Despues de eso la fila queda pero no es valida.

Que estudiar:
- Estructura de la tabla session segun connect-pg-simple
- Como verificar manualmente sesiones en BD
- TTL y limpieza automatica de sesiones expiradas

---

### Paso 4: Probar persistencia entre requests

Que hacer:
1. Iniciar el server (npm run dev)
2. Login con username + password (POST a `/api/auth/login`)
3. Cerrar el navegador
4. Abrir el navegador de nuevo (sin hacer logout)
5. Visitar `/profile` o cualquier ruta protegida
6. Confirmar que el usuario sigue logueado

Pistas:
- Si el usuario sigue logueado la sesion persiste correctamente.
- Si redirige a login hay un problema con el store o la cookie.
- En desarrollo con `secure: false` la cookie funciona en http://localhost.
- En produccion con `secure: true` la cookie SOLO funciona en https.

Que estudiar:
- Cookies httpOnly secure sameSite
- Persistencia vs expiracion de sesiones
- Como debuggear problemas de sesion

---

## Checklist de verificacion

- [ ] `connect-pg-simple` instalado
- [ ] Session middleware actualizado en `app.js`
- [ ] Tabla `session` existe en Neon
- [ ] Login crea una fila en la tabla `session`
- [ ] Logout elimina la fila de `session`
- [ ] Sesion persiste entre reinicios del server
- [ ] Sesion persiste entre requests (sin re-login)
- [ ] Cookie tiene `secure: true` en produccion

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Sesion no persiste | Pool no conectado a Neon o tabla session no existe |
| Error "table session does not exist" | Migraciones no aplicadas (Fase 3 incompleta) |
| Sesion se pierde en cada request | Cookie secure: true en desarrollo (forzando HTTPS que no existe) |
| Sesion expira rapido | `cookie.maxAge` muy bajo o `resave: false` mal configurado |
| Error al conectar al pool | DATABASE_URL mal configurada en .env |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Session store externo | Necesario en serverless donde la memoria no persiste |
| connect-pg-simple | Adapter maduro que usa la misma BD del proyecto |
| Reutilizacion de pool | Evita conexiones duplicadas a Postgres |
| Cookie secure | Requerido en HTTPS para que el navegador envie la cookie |
| createTableIfMissing | Conveniencia para no depender del orden de migraciones |