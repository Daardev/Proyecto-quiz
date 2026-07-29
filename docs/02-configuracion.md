# Fase 2: Configuracion del Proyecto

## Objetivo
Configurar los archivos de soporte del proyecto: scripts de npm, .gitignore, .env.example. Esta fase se enfoca solo en configuracion (no codigo de la app). Al finalizar tendras scripts para dev/start/migrations y un .env.example documentado.

---

### Paso 1: Configurar scripts de package.json

Que hacer:
Agregar/modificar la seccion `scripts` de `backend/package.json`:

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "seed": "node src/seeds/seed.js",
  "seed:questions": "node src/seeds/questions.seed.js",
  "seed:all": "node src/seeds/seed.js && node src/seeds/questions.seed.js"
}
```

Pistas:
- nodemon observa cambios en archivos .js .json .mjs. Si agregas otros tipos (.hbs) revisa la documentacion de nodemon para configurar ext.
- start usa node directo no nodemon. El comando npm start es el estandar para produccion.
- db:generate y db:migrate son de Drizzle. Si no estan las variables de entorno van a fallar. Esta bien se configuran en la Fase 1 Paso 8.
- Los scripts seed pueden fallar si la carpeta src/seeds/ aun no existe. Esta bien se crean en la Fase 3.

Que estudiar:
- npm run vs npm start vs npx
- Diferencia entre scripts personalizados y los hooks de npm (pre/post)
- package.json fields: scripts dependencies devDependencies

---

### Paso 2: Crear .gitignore

Que hacer:
Crear archivo `.gitignore` en la raiz de `backend/` con este contenido:

```
node_modules/
.env
.env.local
.env.production
*.log
npm-debug.log*
.DS_Store
.vscode/
.idea/
```

Pistas:
- Este .gitignore aplica a todo el backend.
- node_modules/ es la exclusion MAS IMPORTANTE. Sin esto subes miles de archivos innecesarios a Git.
- .env .env.local .env.production contienen passwords y API keys. NUNCA deben subirse.
- Si usas VSCode o WebStorm los directorios .vscode/ y .idea/ son personales. Excluirlos evita conflictos entre devs.
- Crea el archivo ANTES de hacer el primer commit. Es la unica forma de asegurar que .env no quede en el historial.

Que estudiar:
- Que es .gitignore y como funciona (patrones glob)
- Que archivos DEBEN ignorarse en un proyecto Node.js
- Diferencia entre .gitignore local y .git/info/exclude

---

### Paso 3: Crear .env y .env.example

Que hacer:
1. Crear archivo `.env` con TODAS las variables que usaras en el proyecto. La lista completa con descripcion esta en `spec.md` seccion 9. Por ahora pueden estar vacias o con valores de desarrollo: `DATABASE_URL` `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `SESSION_SECRET` `JUDGE0_API_URL` `JUDGE0_API_KEY` `PORT` `NODE_ENV`
2. Crear archivo `.env.example` con los mismos nombres y valores vacios (`KEY=`) o placeholders (`DATABASE_URL=postgresql://user:pass@host/db?sslmode=require`)

Pistas:
- `.env` NUNCA se sube a Git (ya esta en .gitignore). `.env.example` SI se commitea (es la documentacion para otros devs).
- La spec seccion 9 es la fuente de verdad sobre que variables existen y que hace cada una.
- SESSION_SECRET debe ser una cadena larga y aleatoria. Puedes generarla con node -e console.log(require(crypto).randomBytes(32).toString(hex)).
- No uses comillas en los valores del .env. PORT=3001 ok PORT=3001 mal.
- dotenv no se configura manualmente si agregas import dotenv/config al inicio de server.js. Tambien puedes usar dotenv.config().
- En produccion (Fase 15) estas variables se configuran en el dashboard de Vercel. No se carga `.env`.

Que estudiar:
- Que es una variable de entorno y por que no hardcodear credenciales
- dotenv - como funciona orden de carga
- Buenas practicas: .env.example secrets management

---

## Checklist de verificacion

- [ ] Scripts en package.json funcionan (npm run dev arranca el server)
- [ ] .gitignore creado y excluye node_modules/ y .env
- [ ] .env existe con todas las variables
- [ ] .env.example existe con los mismos nombres
- [ ] .env NO aparece en `git status` (debe estar ignorado)
- [ ] .env.example SI aparece en `git status` (debe trackearse)

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Scripts no corren | package.json mal formado (JSON invalido) |
| `npm run dev` no detecta cambios | nodemon no instalado o no configurado |
| `.env` aparece en git status | .gitignore no tiene `.env` o fue creado tarde |
| `dotenv` no carga variables | Falta `import dotenv/config` en server.js |
| Variables undefined en runtime | Faltan en .env o tienen typos |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Scripts de npm | Estandariza comandos del proyecto (dev start migrations) |
| .gitignore | Evita subir archivos sensibles o innecesarios |
| .env.example | Documenta que variables necesita el proyecto sin exponer secretos |
| dotenv | Carga variables de entorno desde archivo a process.env |