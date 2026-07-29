# Fase 15: Deploy Backend en Vercel

## Objetivo
Llevar el backend Express + Node a produccion usando Vercel Functions. Base de datos en Neon con proyectos separados (dev y prod). Esta fase cubre el deploy basico. La configuracion avanzada (dominio custom Judge0 OAuth) va en la Fase 16.

---

### Paso 1: Crear proyecto Neon de produccion

Que hacer:
1. Ir a Neon console y crear un proyecto nuevo llamado `quiz-ia-prod` (separado del de desarrollo)
2. Copiar la cadena de conexion (`DATABASE_URL`) con el formato `postgresql://user:pass@host/db?sslmode=require`
3. Ejecutar las migraciones apuntando a esta BD antes del primer deploy:

Fragmento clave (comando para migrar):
```bash
cd backend
DATABASE_URL="<cadena-de-neon-prod>" npx drizzle-kit migrate
```

Pistas:
- **Por que proyecto separado?** Si rompes algo en dev no afecta prod. Aislamiento total.
- Las migraciones se corren MANUALMENTE antes del primer deploy. Vercel las corre automaticas en cada build posterior.
- No corras seeds en prod. Los datos de prod se crean con uso real.

Que estudiar:
- Neon: proyectos cadenas de conexion
- `psql` o `neonctl` para ejecutar SQL manualmente
- Diferencia entre BD de dev y prod

---

### Paso 2: Instalar Vercel CLI

Que hacer:
1. `npm install -g vercel`
2. `vercel login` (abre el navegador)
3. Verificar instalacion: `vercel --version`

Pistas:
- Vercel CLI es similar a Wrangler pero para Vercel.
- `vercel login` autentica via navegador con tu cuenta de GitHub/GitLab/email.
- La CLI no es estrictamente necesaria: podes deployar desde el dashboard web. Pero la CLI es mas comoda.

Que estudiar:
- Vercel CLI: comandos basicos (`vercel deploy` `vercel env` `vercel logs`)
- Deploy desde terminal vs desde Git
- Continuous deployment (auto-deploy en push)

---

### Paso 3: Crear vercel.json en la raiz del backend

Que hacer:
Crear `backend/vercel.json` con la configuracion de deploy:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/styles/(.*)", "dest": "/frontend/public/styles/$1" },
    { "src": "/src/(.*)", "dest": "/frontend/src/$1" },
    { "src": "/(.*)", "dest": "src/app.js" }
  ]
}
```

Pistas:
- `@vercel/node` es el builder de Vercel para apps Node.js. Detecta Express automaticamente.
- Las primeras dos rutas sirven los assets estaticos directamente (sin pasar por Express).
- La tercera ruta captura todo lo demas y lo envia a `app.js`.
- Sin `vercel.json` Vercel intenta adivinar la estructura. Con el archivo le decis exactamente como deployar.

Que estudiar:
- Vercel Build System: como funciona
- Rutas en vercel.json: orden de matching
- `@vercel/node`: capabilities y limitaciones

---

### Paso 4: Crear api/index.js para Vercel Functions

Que hacer:
Vercel Functions espera que el entry point exporte `app` (NO que llame a `app.listen`). Como tu `server.js` actual hace `app.listen`, necesitas un wrapper para Vercel.

Crear `backend/api/index.js`:

Fragmento clave:
```javascript
import app from '../src/app.js';
export default app;
```

Pistas:
- En DESARROLLO usas `server.js` (que arranca con `app.listen`).
- En PRODUCCION (Vercel) Vercel envuelve `app.js` y maneja el listen automaticamente.
- Esto permite que el mismo codigo funcione en ambos entornos sin cambios.

Que estudiar:
- Vercel Functions: como se ejecutan las apps Express
- Entry points: diferencia entre `server.js` (dev) y `api/index.js` (Vercel)
- Export default vs module.exports en ESM

---

### Paso 5: Crear cuenta en Vercel y conectar repo

Que hacer:
1. Ir a vercel.com y crear cuenta (podes usar GitHub para login)
2. Conectar la cuenta de Vercel a tu repo de GitHub/GitLab
3. Darle acceso solo al repo `quiz-ia`

Pistas:
- Vercel tiene plan Free generoso. Suficiente para empezar.
- El plan Free tiene limite de 100 GB de bandwidth y funciones con timeout de 10s.
- El acceso se puede limitar a un solo repo por seguridad.

Que estudiar:
- Vercel: planes y limitaciones
- Continuous deployment: como funciona con Git
- Web Services vs Functions vs Edge Functions

---

### Paso 6: Configurar el proyecto en Vercel

Que hacer:
1. En Vercel dashboard click "Add New Project"
2. Importar el repo `quiz-ia`
3. Configurar:
   - Project Name: `quiz-ia`
   - Framework Preset: Other
   - Root Directory: `backend`
   - Build Command: `npm install && npx drizzle-kit migrate`
   - Output Directory: dejar vacio
   - Install Command: `npm install`

Pistas:
- `Root Directory: backend` le dice a Vercel que entre a esa carpeta antes de instalar y buildear.
- `Build Command` corre las migraciones ANTES de iniciar el server. Si fallan las migraciones el deploy falla.
- `Framework Preset: Other` porque no usamos Next.js ni otros frameworks tipicos.
- `Output Directory` vacio porque Vercel Functions no tiene output estatico tradicional.

Que estudiar:
- Root Directory en Vercel: por que importa
- Build hooks vs Build commands
- Deploy regions: cual elegir cerca de Neon

---

### Paso 7: Configurar variables de entorno en Vercel

Que hacer:
En el dashboard de Vercel ir a "Settings > Environment Variables" y agregar (solo para Production):

- `DATABASE_URL` = cadena de Neon produccion
- `GOOGLE_CLIENT_ID` = de Google Cloud Console
- `GOOGLE_CLIENT_SECRET` = de Google Cloud Console
- `SESSION_SECRET` = cadena aleatoria nueva (NO la misma que dev)
- `JUDGE0_API_URL` = `http://<ip-de-judge0>:2358` (self-hosted) o vacio temporalmente
- `JUDGE0_API_KEY` = vacio (no aplica en self-hosted)
- `NODE_ENV` = `production`
- `PORT` = NO configurar (Vercel lo asigna automaticamente)

Pistas:
- `SESSION_SECRET` en produccion DEBE ser diferente al de desarrollo. Generar uno nuevo con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- Vercel NO expone el puerto al servicio. `process.env.PORT` lo asigna la plataforma.
- `NODE_ENV=production` es importante: en Fase 6 cambia `cookie.secure` a `true` (requerido en HTTPS).
- Puedes marcar variables como "Sensitive" para que no se muestren en logs.

Que estudiar:
- Diferencia entre variables de entorno y secrets
- Ambientes en Vercel: Production Preview Development
- HTTPS y `cookie.secure` en produccion

---

### Paso 8: Deploy inicial

Que hacer:
1. Hacer commit de todos los cambios
2. Push a la rama `main`
3. Vercel detecta el push y empieza el deploy automaticamente
4. Ver el progreso en Vercel dashboard > Deployments

Pistas:
- El primer deploy puede tardar 1-2 minutos (instalar dependencias + correr migraciones).
- Si las migraciones fallan el deploy falla. Ver logs.
- Vercel genera una URL temporal: `https://quiz-ia.vercel.app` (o similar).
- Para deploys manuales desde terminal: `vercel deploy --prod`.

Que estudiar:
- Continuous deployment con Git
- Deploy logs y metrics en Vercel
- Build cache: como Vercel acelera builds

---

### Paso 9: Probar el deploy basico

Que hacer:
1. Visitar `https://quiz-ia.vercel.app/` → debe mostrar el index con tecnologias
2. Visitar `https://quiz-ia.vercel.app/styles/main.css` → debe servir el CSS
3. Visitar `https://quiz-ia.vercel.app/src/lib/api-client.js` → debe servir el JS

Errores comunes:
- 500 Internal Server Error → ver logs de Vercel
- 404 en CSS → rutas en `vercel.json` mal configuradas
- Migraciones no corren → build command mal configurado

Pistas:
- Si algo falla revisa primero los logs de Vercel.
- Las pruebas de login y funcionalidad completa van en la Fase 16 (despues de configurar OAuth y Judge0).

Que estudiar:
- Debugging de deploy: logs metrics traces
- Vercel Functions logs vs build logs

---

## Checklist de verificacion

- [ ] Proyecto Neon de produccion creado y migrado
- [ ] Vercel CLI instalado y logueado
- [ ] `vercel.json` en `backend/` configurado
- [ ] `api/index.js` que exporta `app`
- [ ] Proyecto importado en Vercel dashboard
- [ ] Variables de entorno configuradas en Vercel (Production)
- [ ] Deploy exitoso en Vercel
- [ ] URL `https://quiz-ia.vercel.app` carga el index
- [ ] CSS y JS se sirven correctamente

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 500 Internal Server Error | Logs en Vercel > revisar stack trace |
| 404 en /styles/main.css | Rutas en `vercel.json` mal configuradas |
| Migraciones no corren | Build command mal configurado en Vercel |
| Build falla | Verificar que `api/index.js` existe y exporta correctamente |
| Variables undefined | Configurar todas en Vercel dashboard |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Vercel Functions | Serverless: cada request es una instancia nueva |
| vercel.json | Configuracion explicita del deploy |
| api/index.js | Entry point para Vercel Functions (export default app) |
| Neon proyectos separados | Aislamiento total dev vs prod |
| Continuous deployment | Push a main = deploy automatico |
| Build command con migraciones | Asegura que el schema este actualizado |