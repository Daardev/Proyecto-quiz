# Fase 16: Deploy Produccion Avanzado

## Objetivo
Configurar las dependencias externas (Judge0 self-hosted) y el dominio para el deploy de produccion. Esta fase completa la puesta en marcha del proyecto en Vercel cubriendo lo que la Fase 15 dejo pendiente.

---

### Paso 1: Setup Judge0 self-hosted

Que hacer:
Judge0 debe correr en un servidor accesible desde Vercel. Opciones:

**Opcion A: Servicio Docker separado (Render DigitalOcean Linode)** — desplegar Judge0 via Docker:
1. Crear un servicio en Render (no Vercel porque Render soporta Docker)
2. Configurar para correr: `docker run -d -p 2358:2358 judge0/judge0:latest`
3. Obtener la URL publica del servicio (algo como `https://judge0-tu-app.onrender.com`)
4. Configurar `JUDGE0_API_URL=https://judge0-tu-app.onrender.com`

**Opcion B: RapidAPI** — si preferis zero infra:
1. Crear cuenta en RapidAPI Judge0
2. `JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com`
3. `JUDGE0_API_KEY=<api-key>`
4. Rate limits aplican.

**Opcion C: Mock temporal** — para deployar YA sin Judge0:
1. Modificar `sandbox.service.js` para devolver un resultado mock
2. `JUDGE0_API_URL=` (vacio)
3. Cuando tengas Judge0 real reemplazar el mock.

Pistas:
- Judge0 self-hosted requiere Docker y mantener el servicio corriendo. Mas trabajo pero gratis.
- RapidAPI es zero infra pero tiene rate limits y costos.
- Para el primer deploy podes usar Opcion C (mock) y agregar Judge0 despues.
- Si Judge0 falla el quiz da error graceful. El usuario ve "No se pudo evaluar el codigo".

Que estudiar:
- Judge0 self-hosted con Docker
- Rate limits en RapidAPI
- Mockear servicios externos en desarrollo

---

### Paso 2: Configurar Google OAuth callback de produccion

Que hacer:
1. Ir a Google Cloud Console > APIs & Services > Credentials
2. Editar el OAuth 2.0 Client ID
3. En "Authorized redirect URIs" agregar:
   - `https://Quiz.vercel.app/api/auth/google/callback`
4. Guardar

Pistas:
- Google verifica EXACTAMENTE la URI. Sin `https://` o con path incorrecto falla.
- Si tu app de Vercel es `Quiz.vercel.app` usa esa URI exacta.
- Google puede tardar unos minutos en propagar los cambios.

Que estudiar:
- OAuth redirect URIs: por que Google las exige (seguridad)
- Wildcard URIs en OAuth (no soportadas por Google)

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
- Si usas dominio custom actualiza el redirect URI en Google Console con el nuevo dominio.

Que estudiar:
- DNS basics: A records CNAME propagacion
- Vercel anycast IPs: por que funcionan globalmente
- Let's Encrypt: SSL gratis automatico

---

### Paso 4: Probar el deploy completo

Que hacer:
1. Visitar `https://Quiz.vercel.app/` → debe mostrar el index con tecnologias
2. Hacer login con Google → debe redirigir al callback correctamente
3. Crear un quiz y completarlo
4. Visitar `/profile` → debe mostrar el quiz completado
5. Login como admin (promover primero en Neon prod) → ir a `/admin`
6. Crear una pregunta → debe guardarse en BD prod
7. Verificar DevTools > Network:
   - HTML debe venir de `Quiz.vercel.app`
   - Assets estaticos (CSS) deben servirse correctamente

Errores comunes:
- 500 Internal Server Error → ver logs de Vercel
- Sesion no persiste → verificar que `connect-pg-simple` este conectado y tabla `session` exista
- OAuth redirect_uri_mismatch → Google Console no tiene la URI exacta
- Migraciones no corren → revisar build command en Vercel
- CSS no carga → revisar rutas en `vercel.json`

Pistas:
- Si algo falla revisa primero los logs de Vercel.
- Para promover un admin en prod: conectate a Neon prod y ejecuta el UPDATE de Fase 3.

Que estudiar:
- Debugging de deploy: logs metrics traces
- Vercel Functions logs vs build logs
- Neon Console para verificar datos en BD prod

---

## Checklist de verificacion

- [ ] Judge0 self-hosted corriendo (o mock activo)
- [ ] Google OAuth callback actualizado para `Quiz.vercel.app`
- [ ] Dominio configurado (subdominio gratis o custom)
- [ ] Login con Google funciona en produccion
- [ ] Crear quiz y ver en /profile funciona
- [ ] Admin puede acceder a /admin y crear preguntas
- [ ] Sesiones persisten entre requests
- [ ] Judge0 ejecuta codigo correctamente (si esta configurado)

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| 500 Internal Server Error | Logs en Vercel > revisar stack trace |
| Sesion no persiste | connect-pg-simple no conectado o tabla session no existe |
| OAuth redirect_uri_mismatch | Google Console no tiene la URI exacta |
| Judge0 no responde | Servicio no corriendo o URL incorrecta |
| Dominio custom no resuelve | DNS no propagado o records mal configurados |
| Cold start lento | Normal en Vercel Functions. Considerar Pro plan |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Judge0 self-hosted | Control total sin rate limits (pero requiere infra) |
| Google OAuth callback | URI exacta requerida por Google para evitar ataques |
| Dominio custom vs subdominio | Subdominio es gratis y suficiente para empezar |
| DNS y propagacion | Cambios DNS tardan en propagarse globalmente |
| SSL automatico | Vercel + Let's Encrypt = HTTPS sin configurar nada |