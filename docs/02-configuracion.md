# Fase 2: Configuracion del Proyecto

## Objetivo
Configurar los archivos de soporte del proyecto: scripts de npm, .env y .env.example. Esta fase se enfoca solo en configuracion (no codigo de la app). Al finalizar tendras scripts para dev/start/migrations y un .env.example documentado.

## Contexto

Esta fase continua donde termino **Fase 01**: ya tenes `backend/server.js` que arranca el server con `import 'dotenv/config'` + `app.listen(PORT)`. Esa configuracion usa `SESSION_SECRET` desde `process.env` (con fallback en `app.js`). Falta crear el archivo `.env` que provee esas variables. **`DATABASE_URL` se usara desde Fase 03** cuando se configure la conexion a Neon.

**En esta fase** vas a crear los archivos de soporte que permiten que el server realmente funcione: scripts npm, `.env` y `.env.example`. El `.gitignore` ya esta creado en la raiz del proyecto (Fase 00).

**En Fase 03** se configura la base de datos con Drizzle (los scripts `db:*` que agregues aca empezaran a funcionar ahi).

---

### Paso 1: Configurar scripts de package.json

#### Como realizar el codigo

1. Abrir `backend/package.json` con tu editor
2. Localizar la seccion `scripts` (ya tiene `dev` y `start` de Fase 1)
3. Agregar el resto de scripts **dentro del mismo bloque JSON** (respetar comas)
4. Guardar
5. Verificar JSON valido desde terminal:

    ```powershell
    cd backend
    node -e "JSON.parse(require('fs').readFileSync('package.json'))"
    ```

    Si no hay error, el JSON esta bien.

#### Fragmento clave

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "seed": "node src/seeds/wipe-and-seed.js",
  "migrate:solutions": "node src/seeds/migrate-solutions.js",
  "cleanup:anonymous": "node src/seeds/cleanup-anonymous.js",
  "test:e2e": "node tests/e2e-quiz.js"
}
```

#### Pistas

- nodemon observa cambios en archivos .js .json .mjs. Si agregas otros tipos (.hbs) revisa la documentacion de nodemon para configurar ext.
- start usa node directo no nodemon. El comando `npm start` es el estandar para produccion.
- **Solo `dev` y `start` funcionan al terminar esta fase**. Los siguientes scripts requieren codigo de fases posteriores:
  - `db:generate`, `db:migrate`: requieren Drizzle instalado (Fase 03)
  - `seed` (wipe-and-seed.js): requiere schema creado (Fase 03) y preguntas batch (Fase 04)
  - `migrate:solutions`: requiere schema (Fase 03)
  - `cleanup:anonymous`: requiere schema (Fase 03)
  - `test:e2e`: requiere la app completa (Fase 09+) y `npx playwright install chromium`
- `seed`: ejecuta `wipe-and-seed.js` que borra datos obsoletos, aplica migraciones pendientes y carga las preguntas iniciales. **Este es el unico script de seed valido** — los legacy `seed.js` y `questions.seed.js` (que referenciaban tablas eliminadas `technologies`/`categories`) fueron borrados.
- `migrate:solutions`: agrega la columna `questions.solution` (TEXT) si no existe y la puebla desde `questions-batch.json` para cada pregunta. **Es idempotente** — se puede correr multiples veces sin errores. **Redundante con el seed inicial** (`wipe-and-seed.js` ya agrega `solution` y la puebla). Util solo si tenes preguntas existentes sin `solution` poblada y queres backfill desde el JSON.
- `cleanup:anonymous`: elimina `quizzes` anonimos (`user_id IS NULL`) **mas antiguos que N dias** (default 7, configurable con `--days N`). Acepta flag `--dry-run` para previsualizar sin borrar. **Script de mantenimiento**, no de setup. Util para limpiar el entorno despues de tests E2E.
- `test:e2e`: ejecuta el test end-to-end con Playwright. **Requiere `npx playwright install chromium` la primera vez** (descarga el browser headless). Verifica el flujo completo: register → start quiz → submit → results.

#### Que estudiar

- `npm run` vs `npm start` vs `npx`: como npm encuentra los comandos (PATH, `node_modules/.bin/`)
- Diferencia entre scripts personalizados y los hooks de npm (`pre`, `post`: ej. `prebuild`, `postinstall`)
- `package.json` fields: `scripts`, `dependencies`, `devDependencies`
- Lifecycle scripts: orden de ejecucion de `pre`/`post`

#### Documentacion a consultar

- [npm scripts (oficial)](https://docs.npmjs.com/cli/v10/using-npm/scripts)
- [package.json specification](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)

---

### Paso 2: Crear .env y .env.example

#### Como realizar el codigo

1. Abrir PowerShell en la raiz del proyecto
2. Crear ambos archivos:

    ```powershell
    New-Item -ItemType File -Force -Path "backend\.env"
    New-Item -ItemType File -Force -Path "backend\.env.example"
    ```

3. Abrir `backend/.env` con tu editor
4. Llenar con valores reales (ver Listado de variables abajo)
5. Abrir `backend/.env.example` con tu editor
6. Llenar con los **mismos nombres** pero **valores vacios** (es la documentacion para otros devs)
7. Verificar que `.env` esta ignorado:

    ```powershell
    git check-ignore -v backend/.env
    ```

8. Verificar que `.env.example` **NO** esta ignorado:

    ```powershell
    git check-ignore -v backend/.env.example
    ```

    No debe retornar nada (un archivo tracked no es ignorado).

#### Listado de variables

(Fuente: `docs/spec.md` seccion 9)

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | Cadena de conexion a PostgreSQL (Neon). Formato: `postgresql://user:pass@ep-xxxx-pooler.sa-east-1.aws.neon.tech/dbname?sslmode=require` |
| `SESSION_SECRET` | Si | Cadena aleatoria larga para firmar cookies. |
| `ADMIN_USERNAME` | No | Username del admin creado automaticamente al iniciar el server |
| `ADMIN_PASSWORD` | No | Password del admin creado automaticamente al iniciar el server |
| `ADMIN_EMAIL` | No | Email del admin (default: `${ADMIN_USERNAME}@admin.local`) |
| `NODE_ENV` | No | `development` o `production`. Default: `development` |
| `PORT` | No | Puerto del servidor. Default: `3001`. En Vercel lo asigna la plataforma |

#### Pistas

- `.env` **NUNCA** se sube a Git (ya esta en `.gitignore`). `.env.example` **SI** se commitea (es la documentacion para otros devs).
- `SESSION_SECRET` debe ser una cadena larga y aleatoria. Puedes generarla ejecutando `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` en otra terminal y pegar el resultado en `.env`.
- No uses comillas en los valores del `.env`: `PORT=3001` OK, `"PORT=3001"` MAL.
- `dotenv` se importa en el codigo JS (`server.js`, `app.js`), NO en el `.env` mismo.
- En produccion (Fase 15) estas variables se configuran en el dashboard de Vercel. **No se carga `.env`** en produccion.
- **Valores tentativos para variables de fases futuras**: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `ADMIN_EMAIL` se usan en Fases 03 y 05 respectivamente. Al terminar esta fase, podes dejarlos vacios o con valores placeholder (ej: `DATABASE_URL=`, `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=changeme`). Los valores reales se obtendran en sus fases correspondientes.

#### Que estudiar

- Que es una variable de entorno y por que no hardcodear credenciales
- `dotenv` - como funciona, orden de carga (lee `.env` en `process.cwd()`)
- `dotenv` vs `dotenv-expand` (interpolacion de variables: `${OTHER_VAR}`)
- Variables de entorno del sistema (PATH, HOME) vs variables de la app
- The Twelve-Factor App - Config: por que `.env.example` se commitea y `.env` no

#### Documentacion a consultar

- [dotenv (oficial)](https://github.com/motdotla/dotenv#readme)
- [The Twelve-Factor App - Config](https://12factor.net/config)
- [Node.js process.env](https://nodejs.org/api/process.html#processenv)

---

### Paso 3: Verificar la configuracion

Que hacer:

1. **Verificar que npm ve los scripts**:

    ```powershell
    cd backend
    npm run
    ```

    Debe listar todos los scripts del `package.json`.

2. **Verificar que `.env` esta ignorado**:

    ```powershell
    git check-ignore -v backend/.env
    ```

    Debe retornar la linea de la regla que lo ignora.

3. **Verificar que `.env.example` NO esta ignorado**:

    ```powershell
    git check-ignore -v backend/.env.example
    ```

    No debe retornar nada (un archivo tracked no es ignorado). El comando `git ls-files` no aplica aca porque `backend/` aun no esta commiteado — eso se hara en una fase posterior.

4. **Verificar que el server arranca**:

    ```powershell
    cd backend
    npm run dev
    ```

    Debe mostrar `Servidor en http://localhost:3001`. Presionar Ctrl+C para detener.

    > **Requisito**: este paso funciona porque `app.js` de Fase 01 es minimo (no importa `config/database.js`). Si modificaste `app.js` para importar `config/database.js`, el server fallara con `DATABASE_URL is not set` hasta completar Fase 03.

5. **Verificar que `dotenv` carga variables** (opcional, debug):
   Agregar `console.log(process.env.PORT)` temporalmente en `backend/server.js`, ejecutar `npm run dev`, ver que imprime `3001` (o el valor que pusiste en `.env`). **Borrar el `console.log` despues de verificar**.

---

## Checklist de verificacion

- [ ] Scripts en `package.json` funcionan (`npm run dev` arranca el server)
- [ ] `npm run` lista todos los scripts esperados
- [ ] `backend/.env` existe con todas las variables (con valores reales o tentativos)
- [ ] `backend/.env.example` existe con los mismos nombres (con valores vacios)
- [ ] `.env` NO aparece en `git status` (debe estar ignorado por el `.gitignore` raiz)
- [ ] `git check-ignore -v backend/.env` retorna una regla
- [ ] `git check-ignore -v backend/.env.example` **NO** retorna nada (debe estar tracked, NO ignorado)

> **Nota**: `git ls-files` solo lista archivos tracked. Como `backend/` aun no esta commiteado al terminar esta fase, ese comando no aplica aca. Se usara mas adelante cuando se haga el primer commit de `backend/`.

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Scripts no corren | `package.json` mal formado (JSON invalido). Verificar con `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` |
| `npm run dev` no detecta cambios | nodemon no instalado o no configurado en devDependencies |
| `.env` aparece en git status | `.gitignore` no tiene `.env` o fue creado tarde |
| `dotenv` no carga variables | Falta `import 'dotenv/config'` en `server.js` |
| Variables `undefined` en runtime | Faltan en `.env` o tienen typos |
| `db:generate` falla con "command not found" | Drizzle no esta instalado (se instala en Fase 03) |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Scripts de npm | Estandariza comandos del proyecto (dev, start, migrations) |
| `.gitignore` | Evita subir archivos sensibles o innecesarios |
| `.env` / `.env.example` | Maneja credenciales sin hardcodear, sin exponer secretos |
| `dotenv` | Carga variables de entorno desde archivo a `process.env` |
| Variables de entorno | Permiten config distinta por entorno (dev/prod) sin cambiar codigo |

---

## Que viene en Fase 3

En **Fase 3** se instalan las deps de Drizzle (`drizzle-orm`, `pg`, `drizzle-kit`), se crea el schema completo (6 tablas) y se configura la conexion a Neon usando `DATABASE_URL` (la variable que ya esta en tu `.env`).

**Al terminar Fase 03** los siguientes scripts dejaran de fallar:
- `db:generate` (genera archivos SQL de migracion)
- `db:migrate` (aplica las migraciones a Neon)
- `seed` (wipe-and-seed.js carga preguntas en BD)
- `migrate:solutions` (backfill opcional)
- `cleanup:anonymous` (mantenimiento de quizzes anonimos)

`test:e2e` requerira ademas Fases 09+ (registro, login, sandbox funcionando).

**Bridge de inputs/outputs:**

| De Fase 02 | A Fase 03 |
|------------|-----------|
| `package.json` con scripts `db:*` | Fase 03 instala las deps que esos scripts invocan |
| `.env` con `DATABASE_URL` | Fase 03 usa esa URL para conectar a Neon |
| `.gitignore` excluye `.env` | Garantiza que credenciales no se filtran |