# Fase 16: Deploy Produccion Avanzado

## Objetivo
Configurar las dependencias externas (ninguna, ya que el sandbox es WebAssembly local) y el dominio para el deploy de produccion. Esta fase completa la puesta en marcha del proyecto en Vercel cubriendo lo que la Fase 15 dejo pendiente.

---

### Paso 1: Validar sandbox WebAssembly en produccion

Que hacer:
El sandbox WASM (QuickJS + PGlite) corre en proceso. NO requiere servicios externos. Verificar:

1. QuickJS-WASM (`quickjs-emscripten`) carga correctamente en Vercel Functions
2. PGlite (`@electric-sql/pglite`) ejecuta SQL en memoria
3. Bundle no excede limites de Vercel (250 MB unzipped)

Pistas:
- Ambos paquetes instalan archivos `.wasm` que Vercel Functions puede leer del filesystem.
- Si PGlite falla por falta de `shared memory`, agregar en `vercel.json`:
  ```json
  {
    "functions": {
      "api/index.js": {
        "memory": 1024
      }
    }
  }
  ```
- Si los archivos `.wasm` no se incluyen en el deploy, verificar `.vercelignore` y el `package.json`.
- Cold start: primera ejecucion ~200-500 ms por carga de WASM. Las siguientes son <50 ms.

Opciones si WASM no es viable en Vercel:
- **Opcion A (recomendada)**: mantener WASM, ajustar memory en `vercel.json`
- **Opcion B**: migrar a un servicio separado (Render, Railway) que soporte procesos largos
- **Opcion C**: usar Judge0 via RapidAPI (NO recomendado, contradice el spec actual)

Que estudiar:
- Vercel Functions memory limits
- WebAssembly module loading en serverless
- Trade-offs: serverless vs long-running process

---

### Paso 2: Configurar bootstrap admin en produccion

Que hacer:
Verificar que las variables de entorno para el bootstrap admin estan configuradas:

1. En Vercel dashboard ir a Settings > Environment Variables
2. Confirmar que existen:
   - `ADMIN_USERNAME` = username deseado (ej: `admin`)
   - `ADMIN_PASSWORD` = password seguro (NO el mismo que dev)
   - `ADMIN_EMAIL` = email del admin (opcional)
3. Marcar `ADMIN_PASSWORD` como "Sensitive"
4. Redesplegar para que tome efecto

Pistas:
- El bootstrap corre la primera vez que `app.js` se carga en Vercel (al primer request post-deploy).
- Si el admin ya existe, lo promueve a `role='admin'` si no lo es.
- Si las variables no estan configuradas, el bootstrap loggea mensaje y no hace nada (no falla).
- Cambiar `ADMIN_PASSWORD` en Vercel NO cambia el password del admin existente. Para eso, hacer un UPDATE manual en Neon prod.

Que estudiar:
- Idempotencia: bootstrap puede correr multiples veces sin romper
- Separacion dev vs prod: passwords y secrets diferentes
- Sensitive env vars en Vercel

---

### Paso 3: Configurar dominio (opcional)

Que hacer:
**Opcion A: Usar subdominio gratuito de Vercel** (recomendado para empezar):
- Tu app queda en `https://Quiz.vercel.app`
- No requiere configuracion adicional
- SSL automatico

**Opcion B: Dominio custom** (cuando lo necesites):
1. Comprar dominio (Namecheap Google Domains etc)
2. En Vercel: Settings > Domains > Add
3. Vercel te dara los DNS records para configurar
4. En tu registrador agregar los records:
   - Tipo A o CNAME segun Vercel indique
   - Apuntar a `76.76.21.21` (Vercel anycast IP)
5. Esperar propagacion DNS (minutos a horas)
6. SSL se configura automatico via Let's Encrypt

Pistas:
- El subdominio `vercel.app` es suficiente para empezar.
- Vercel incluye SSL gratis con Let's Encrypt tanto para subdominio como para dominio custom.
- Si usas dominio custom, no hay redirect URIs de OAuth que actualizar (no usamos OAuth en este proyecto).

Que estudiar:
- DNS basics: A records CNAME propagacion
- Vercel anycast IPs: por que funcionan globalmente
- Let's Encrypt: SSL gratis automatico

---

### Paso 4: Probar el deploy completo

Que hacer:
1. Visitar `https://Quiz.vercel.app/` → debe mostrar el index con tecnologias
2. Hacer `POST /api/auth/register` con un nuevo usuario → debe crear cuenta y establecer sesion
3. Hacer `POST /api/auth/login` con admin → debe redirigir o devolver JSON con user.role=admin
4. Visitar `/profile` → debe mostrar el usuario autenticado
5. Login como admin (promover primero en Neon prod si no se hizo via env vars) → ir a `/admin`
6. Crear una pregunta → debe guardarse en BD prod
7. Generar quiz y enviar respuesta → debe ejecutar codigo en WASM y devolver score

Errores comunes:
- 500 Internal Server Error → ver logs de Vercel
- Sesion no persiste → verificar que `connect-pg-simple` este conectado y tabla `session` exista
- Sandbox WASM no responde → verificar que el bundle se subio y memory es suficiente
- Admin no puede acceder a `/admin` → `ADMIN_USERNAME`/`ADMIN_PASSWORD` no configurados o rol no promovido
- Login retorna 401 → password incorrecto (recordar que dev y prod son BDs separadas)

Pistas:
- Si algo falla revisa primero los logs de Vercel.
- Para promover un admin en prod: si las env vars `ADMIN_USERNAME`/`ADMIN_PASSWORD` no estaban configuradas, conectar a Neon prod y ejecutar `UPDATE users SET role='admin' WHERE username='admin';`.

Que estudiar:
- Debugging de deploy: logs metrics traces
- Vercel Functions logs vs build logs
- Neon Console para verificar datos en BD prod
- Aislamiento dev/prod: usuarios y passwords son distintos

---

## Checklist de verificacion

- [ ] Sandbox WASM carga y ejecuta correctamente en produccion
- [ ] QuickJS ejecuta JavaScript/Node.js sin errores
- [ ] PGlite ejecuta SQL real en proceso
- [ ] Bundle no excede limites de Vercel
- [ ] Bootstrap admin funciona (env vars configuradas)
- [ ] Dominio configurado (subdominio gratis o custom)
- [ ] Register funciona en produccion
- [ ] Login funciona en produccion
- [ ] Sesiones persisten entre requests
- [ ] Crear quiz y ver en /profile funciona
- [ ] Admin puede acceder a /admin y crear preguntas
- [ ] Sandbox ejecuta codigo y devuelve score correcto

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 500 Internal Server Error | Logs en Vercel > revisar stack trace |
| Sesion no persiste | connect-pg-simple no conectado o tabla session no existe (Fase 6) |
| Admin no puede acceder a /admin | `ADMIN_USERNAME`/`ADMIN_PASSWORD` no configurados o rol no promovido |
| Sandbox WASM no responde | Bundle no se subio, falta memory, o archivo `.wasm` no se incluyo |
| Dominio custom no resuelve | DNS no propagado o records mal configurados |
| Cold start lento | Normal en Vercel Functions, primera ejecucion tarda ~200-500 ms por carga de WASM |
| Score siempre 0 | Preguntas sin tests_template o categoria no detectada correctamente |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Sandbox WASM local | Sin servicios externos, sin rate limits, sin costos por ejecucion |
| Bootstrap admin via env | Patron de inicializacion idempotente al arranque |
| Subdominio vs dominio custom | Subdominio es gratis y suficiente para empezar |
| DNS y propagacion | Cambios DNS tardan en propagarse globalmente |
| SSL automatico | Vercel + Let's Encrypt = HTTPS sin configurar nada |
| Aislamiento dev/prod | BDs separadas con usuarios y passwords distintos |
