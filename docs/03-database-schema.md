# Fase 3: Database Schema y Conexion a Neon

## Objetivo
Definir todas las tablas del proyecto usando Drizzle ORM, conectar a Neon (PostgreSQL serverless) y generar la primera migracion. Al finalizar tu base de datos deberia tener las 6 tablas creadas.

## Contexto

Esta fase continua donde termino **Fase 02**: ya tenes `package.json` con los scripts `db:generate` y `db:migrate`, y `.env` con `DATABASE_URL`. Estos dos ingredientes son la base para esta fase.

**En esta fase** vas a:
1. Instalar las dependencias de Drizzle
2. Definir las 6 tablas del schema
3. Configurar la conexion a Neon
4. Generar y aplicar las migraciones

**Al finalizar Fase 03** los siguientes scripts dejaran de fallar: `db:generate`, `db:migrate`, `seed`, `migrate:solutions`, `cleanup:anonymous`.

**Nota sobre el throw de `DATABASE_URL`**: el error se activa cuando algo importa `config/database.js`. En esta fase solo lo importas vos en los Pasos 5 y 10. En fases futuras (controllers, services, seeds), los archivos del proyecto tambien lo importan. Si tu `app.js` no importa `config/database.js` (caso de Fase 01), el server sigue arrancando sin requerir `DATABASE_URL`. Si actualizas `app.js` para usar la BD (como en el codigo real del proyecto), el server requerira `DATABASE_URL` desde el arranque.

---

### Paso 1: Instalar dependencias de BD

Que hacer:
- npm install pg drizzle-orm
- npm install --save-dev drizzle-kit

Pistas:
- `pg` es el driver de PostgreSQL para Node. Drizzle lo necesita internamente para conectarse.
- `drizzle-orm` es el ORM para correr queries en runtime. Va en dependencies.
- `drizzle-kit` es el CLI de Drizzle para generar migraciones, NO es el ORM en si. Por eso va en devDependencies.
- No confundas `drizzle-orm` (runtime, queries) con `drizzle-kit` (dev, migraciones).
- Estas dependencias no se instalaron en Fase 1 a proposito (mantener dependencias por fase).

Que estudiar:
- Diferencia entre ORM (runtime) y Kit (herramienta de desarrollo)
- Que genera drizzle-kit exactamente (archivos SQL en drizzle/)
- Por que `pg` es necesario aunque uses Drizzle

---

### Paso 2: Crear drizzle.config.js

#### Como realizar el codigo

1. Abrir PowerShell en la raiz del proyecto
2. Crear el archivo:

    ```powershell
    New-Item -ItemType File -Force -Path "backend\drizzle.config.js"
    ```

3. Abrir `backend/drizzle.config.js` con tu editor
4. Copiar el fragmento clave
5. Guardar

#### Fragmento clave

Crear `drizzle.config.js` en la raiz de `backend/` con:
- schema: ruta al archivo de schema (./src/drizzle/schema.js)
- out: carpeta de salida de migraciones (./drizzle)
- dialect: postgresql
- dbCredentials.url: process.env.DATABASE_URL

Pistas:
- En versiones recientes de Drizzle se usa dialect: postgresql en vez de driver pg. Revisa la documentacion actual al momento de hacerlo.
- El connectionString o url se lee desde process.env asi que necesitas que las variables de entorno esten cargadas. Drizzle Kit no usa dotenv automaticamente.
- schema apunta a un archivo creado (vacio) en Fase 01. Lo llenas en el Paso 3.

Que estudiar:
- Drizzle Config - todas las opciones disponibles
- Que es dialect y por que se especifica
- Diferencia entre driver (versiones antiguas) y dialect (versiones recientes)

---

### Paso 3: Definir schema completo

#### Como realizar el codigo

1. Abrir PowerShell en la raiz del proyecto
2. Crear el archivo (si no existe desde Fase 01):

    ```powershell
    New-Item -ItemType File -Force -Path "backend\src\drizzle\schema.js"
    ```

3. Abrir `backend/src/drizzle/schema.js` con tu editor
4. Definir las 6 tablas usando `pgTable` de `drizzle-orm/pg-core` (ver fragmento clave)
5. Guardar

#### Fragmento clave

Definir las siguientes tablas usando pgTable de drizzle-orm/pg-core:

1. **users**: id (serial PK), username (varchar 30 unique not null), email (varchar 255 unique not null), name (varchar 255 not null default ''), passwordHash (varchar 255 not null columna password_hash), role (varchar 20 not null default 'user', valores: 'user' | 'admin'), createdAt (timestamp defaultNow)

2. **questions**: id (serial PK), language (varchar 20 not null default 'javascript'), type (varchar 20 not null default 'code', valores: 'code' | 'multiple_choice'), title (varchar 255 not null), description (text not null), starterCode (text nullable), testsTemplate (json nullable), options (json nullable), correctOption (integer nullable), solution (text nullable), solutions (json nullable), isActive (boolean not null default true columna is_active), hash (varchar 32 unique not null), createdAt (timestamp defaultNow)

3. **quizzes**: id (serial PK), userId (integer FK a users.id nullable), language (varchar 20 not null default 'javascript'), startedAt (timestamp defaultNow), completedAt (timestamp nullable), attemptsLeft (integer not null default 5)

4. **quizQuestions** (tabla pivote): id (serial PK), quizId (integer FK a quizzes.id not null), questionId (integer FK a questions.id not null), order (integer not null), attemptsCount (integer not null default 0)

5. **submissions**: id (serial PK), quizQuestionId (integer FK a quizQuestions.id not null), code (text not null), sandboxResults (json nullable), score (integer nullable), evaluatedAt (timestamp nullable), kind (varchar 20 not null default 'answer', valores: 'answer' | 'skipped')

6. **session** (usada por `connect-pg-simple` para sesiones): sid (varchar PK), sess (json not null), expire (timestamp not null)

Pistas:
- El nombre de la columna en JS (camelCase) puede ser diferente al nombre en BD (snake_case). Usa el segundo parametro de pgTable: varchar('column_name_in_db', length: 255).
- La FK `userId` en quizzes puede ser null (un quiz puede ser anonimo).
- `language` es varchar(20) con default 'javascript'. Valores posibles: `'javascript'`, `'sql'`, `'node'`, `'html-css-js'`, `'js-avanzado'`, `'git'`. Ver `spec.md` §6 para que sandbox usa cada uno.
- `type` es varchar(20) con default 'code'. Valores posibles: 'code', 'multiple_choice'.
- `difficulty` NO existe (modelo simplificado sin niveles). El score es fijo: `(testsPasados / testsTotales) × 100`.
- `starterCode`, `testsTemplate`, `options`, `correctOption`, `solution`, `solutions` son nullables: solo se usan según el `type`:
  - `type='code'` → requiere starterCode + (testsTemplate **o** solutions). Si ambos existen, `solutions` tiene prioridad (ver `sandbox.service.js:runAgainstSolutions`).
  - `type='multiple_choice'` → requiere options (json array) + correctOption (integer) + solution (texto explicativo).
- `solution` (text) — texto plano que se muestra en la pantalla de resultados. Para MC explica por qué la opción correcta es la correcta. Para código se usa como fallback si `solutions` esta vacio.
- `solutions` (json) — array de `{ code, tests }`. Cada elemento es una solución candidata con sus tests. El sandbox ejecuta el código del usuario contra los `tests` de **cada** solución; la pregunta se considera correcta si **alguna** de las soluciones pasa **todos** sus tests. Esto permite múltiples respuestas válidas (ej: `sum(a,b)` y `sum(b,a)` son equivalentes). Implementación: `sandbox.service.js:runAgainstSolutions`.
- `is_active` (boolean default true) — soft delete. El admin dashboard (Fase 14) hace `UPDATE questions SET is_active=false` en vez de DELETE.
- `hash` es un MD5 de title+description. Se usa para evitar preguntas duplicadas. Sin unique constraint en hash la deduplicacion no funciona.
- `quizzes.attempts_left` (int default 5) — vidas del quiz (corazones en UI). Se decrementa solo en envíos **incorrectos** de `submitAnswer` o al ejecutar `skipQuestion`. Cuando llega a 0, el quiz termina y `getCurrentQuestion` devuelve `{ done: true }`, lo que dispara el redirect a `/results`.
- `quiz_questions.attempts_count` (int default 0) — contador de envíos del usuario para esta pregunta en este quiz. NO consume vidas del quiz; es solo métrica visible en la UI ("intentos: 3") y en `/results`.
- `submissions.kind` (`varchar(20) default 'answer'`) — distingue envíos reales (`'answer'`) de saltos (`'skipped'`). Una pregunta con `kind='skipped'` cuenta como resuelta para avanzar el quiz. Implementación: `submissions.controller.js:skipQuestion`.
- `defaultNow()` se traduce a DEFAULT NOW() en PostgreSQL.
- Las relaciones (FKs) se definen con `.references(() => otraTabla.id)`.
- `testsTemplate` es JSON porque almacena un array de objetos de prueba (`{input, expected}`). Drizzle lo maneja como json type.

Que estudiar:
- Drizzle schema: tipos de columna (serial varchar text integer json timestamp)
- references() - Foreign Keys integridad referencial
- unique() - que pasa si intentas insertar un duplicado
- defaultNow() - timestamps automaticos
- camelCase en JS vs snake_case en BD - mapeo de nombres
- json type en PostgreSQL vs JSONB - diferencias
- upsert vs replace: el controller hace `UPDATE submissions` si ya existe (no `INSERT` con conflict), lo que evita race conditions en envíos concurrentes

---

### Paso 4: Configurar conexion a base de datos

#### Como realizar el codigo

1. Abrir `backend/src/config/database.js` con tu editor (creado vacio en Fase 01)
2. Agregar los imports
3. Agregar el Pool de pg
4. Configurar SSL
5. Exportar `db` y `pool`
6. Guardar

#### Fragmento clave

Llenar `src/config/database.js` con:
1. Importe Pool de pg
2. Importe drizzle de drizzle-orm/node-postgres
3. Importe el schema desde ../drizzle/schema.js
4. Cree un Pool con connectionString: process.env.DATABASE_URL
5. Exporte db (instancia de drizzle) y el pool
6. Configurar SSL para Neon: ssl rejectUnauthorized: false

Pistas:
- Neon requiere SSL. Sin ssl: true la conexion va a fallar con error no pg_hba.conf entry.
- Pool maneja un grupo de conexiones reutilizables. Es mejor que una conexion unica porque no satura la BD.
- Drizzle necesita el schema para tener type-safety en las queries. Sin pasarlo las queries siguen funcionando pero sin autocompletado.
- drizzle-orm/node-postgres es el adapter especifico para PostgreSQL con pg. Si usaras MySQL seria drizzle-orm/mysql2.

Que estudiar:
- Connection pooling en PostgreSQL - por que es importante
- Neon SSL requirement - que es SSL/TLS en BD
- Drizzle adapters - node-postgres vs neon serverless
- pg Pool: connect() query() end()

---

### Paso 5: Probar conexion

Que hacer:
1. Probar la conexion con un comando one-liner:

    ```bash
    cd backend
    node -e "(async () => { const {db} = await import('./src/config/database.js'); const {sql} = await import('drizzle-orm'); const r = await db.execute(sql`SELECT 1 AS ok`); console.log('Conexion OK:', r.rows); process.exit(0); })().catch(e => { console.error(e); process.exit(1); })"
    ```

2. Si la conexion funciona, veras `Conexion OK: [ { ok: 1 } ]` (el array contiene un objeto con `ok: 1`)
3. Si falla, revisa los Errores comunes abajo

Pistas:
- Si la conexion falla revisa: (1) DATABASE_URL tiene el formato correcto (2) Neon acepta conexiones desde tu IP (3) SSL esta configurado.
- `db.execute(SELECT 1)` es la forma mas simple de verificar que la conexion esta viva.
- Este paso no crea archivos en el proyecto (usa `node -e` inline).

Que estudiar:
- db.execute() vs db.query() vs db.select() en Drizzle
- Formato de connection string de Neon: `postgresql://user:pass@ep-xxxx-pooler.sa-east-1.aws.neon.tech/dbname?sslmode=require`

---

### Paso 6: Generar migraciones

Que hacer:
- npx drizzle-kit generate

Pistas:
- Este comando compara tu schema actual con el estado de la BD y genera archivos SQL en drizzle/.
- Si es la primera vez vas a ver algo como drizzle/0000_xxxx_migration.sql. Ese archivo contiene el CREATE TABLE de todas las tablas.
- Si despues modificas el schema la siguiente migracion sera 0001_xxxx.sql no se regenera desde cero.

Que estudiar:
- Migraciones: por que no usar sync force true como en otros ORMs
- Drizzle Kit: generate migrate push introspect
- Archivos de migracion: como leerlos para entender que va a cambiar

---

### Paso 7: Aplicar migraciones a Neon

Que hacer:
- npx drizzle-kit migrate

Pistas:
- migrate ejecuta los archivos SQL pendientes contra la BD. No corre archivos ya aplicados (lleva tracking en tabla __drizzle_migrations).
- Si el comando falla revisa que DATABASE_URL este seteada en el entorno o en .env.
- Alternativa: puedes ejecutar manualmente el SQL generado usando la consola web de Neon.

Que estudiar:
- Tabla __drizzle_migrations - como trackea Drizzle las migraciones aplicadas
- migrate vs push - diferencias y cuando usar cada uno

---

### Paso 8: Migraciones DDL no soportadas por Drizzle (patrón wipe-and-seed)

Que hacer:
Drizzle Kit **no soporta** `DROP TABLE`, `DROP COLUMN` ni `ALTER TABLE` complejos (solo `ADD COLUMN` basico). Si necesitas eliminar tablas o columnas obsoletas entre migraciones, **no las pongas en archivos `drizzle/*.sql`**. En su lugar, ejecuta el DDL directamente desde un script de Node con `db.execute(sql\`...\`)`.

Ejemplo real (de `src/seeds/wipe-and-seed.js`):

```javascript
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';

await db.execute(sql`DROP TABLE IF EXISTS categories CASCADE`);
await db.execute(sql`ALTER TABLE questions DROP COLUMN IF EXISTS difficulty`);
await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution TEXT`);
```

Pistas:
- `DDL` = Data Definition Language (CREATE, ALTER, DROP). Drizzle Kit solo soporta un subset minimo (CREATE TABLE, ADD COLUMN con default).
- Si necesitas `DROP COLUMN`, `RENAME COLUMN`, `ALTER TYPE`, etc., hazlo en un script de Node que se ejecute despues de las migraciones de Drizzle.
- El patron usado en este proyecto: `wipe-and-seed.js` (Fase 4) ejecuta primero la limpieza DDL y luego el INSERT. Es idempotente: corre multiples veces sin errores.
- Una alternativa mas "limpia" es crear una nueva migración Drizzle que sea solo `DROP TABLE/COLUMN`. Drizzle Kit puede generarla como una migración vacia si el schema nuevo no tiene la columna. Pero requiere ejecutar `drizzle-kit generate` y `migrate` en orden.

Que estudiar:
- Por que Drizzle Kit es conservador con DDL: https://orm.drizzle.team/docs/kit-overview
- Migraciones progresivas vs migraciones destructivas
- `CREATE TABLE IF NOT EXISTS`, `DROP TABLE IF EXISTS`, `ADD COLUMN IF NOT EXISTS`: idempotencia en SQL

---

### Paso 9: Estructura esperada de la carpeta `drizzle/`

Que hacer:
La carpeta `backend/drizzle/` (raiz del backend) contiene los archivos de migración generados por `drizzle-kit generate`. NO los edites a mano. Subir a Git: sí (son la fuente de verdad del schema en producción).

Estructura esperada tras esta fase:

```
backend/drizzle/
  0000_<nombre>.sql         ← migración inicial (modelo antiguo: contiene categories, technologies)
  0001_<nombre>.sql         ← ajustes: DROP NOT NULL, agrega type/options/correct_option
  0002_<nombre>.sql         ← agrega quizzes.attempts_left + submissions.kind
  0003_<nombre>.sql         ← agrega quiz_questions.attempts_count
  meta/
    _journal.json           ← tracking de migraciones aplicadas
    0000_snapshot.json      ← snapshot por cada migración
    0001_snapshot.json
    0002_snapshot.json
    0003_snapshot.json
```

Pistas:
- `<nombre>` es autogenerado por Drizzle Kit (ej: `0000_brave_giant_girl.sql`). No lo modifiques.
- Cada vez que hagas `drizzle-kit generate`, se crea un nuevo archivo `NNNN_*.sql` con el **delta** desde el ultimo snapshot.
- Los snapshots en `meta/` son la "memoria" de Drizzle: permiten calcular el delta. Sin ellos `drizzle-kit generate` no funciona.
- Si tu primera migración `0000` parece "incorrecta" (ej: contiene tablas que tu schema actual no tiene, como `categories` o `technologies`), es porque fue generada cuando el proyecto tenia un modelo antiguo. Ver el siguiente punto.

> **Nota historica**: la primera migración `0000` de este proyecto contiene el modelo antiguo con `categories`, `technologies`, `category_id`, `difficulty`, `technology_id`. El schema actual es mas simple (ver Paso 3). Si tu BD ya esta limpia y quieres empezar de cero, borra todo el contenido de `backend/drizzle/` y ejecuta `npx drizzle-kit generate` — generara una nueva `0000` con el schema actual. Si tu BD ya tiene datos, **no borres las migraciones**: el script `wipe-and-seed.js` (Fase 4) se encarga de limpiar el esquema obsoleto en runtime.

Que estudiar:
- `drizzle-kit generate` vs `drizzle-kit migrate` vs `drizzle-kit push`
- Que son los snapshots (`meta/*.json`) y por que son necesarios
- Estrategia de migraciones en proyectos en evolución: mantener historial vs resetear

---

## Que viene en Fase 4

Las 6 tablas existen en Neon pero estan vacias. En **Fase 4** se cargan las preguntas iniciales usando `npm run seed` (que ejecuta `wipe-and-seed.js`).

**wipe-and-seed.js hace** (idempotente, corre multiples veces sin errores):
1. DROP de tablas/columnas obsoletas (categorias, technologies, difficulty, etc.)
2. ALTER TABLE para agregar columnas nuevas (`solution`, etc.)
3. TRUNCATE de las tablas de datos
4. INSERT de preguntas desde `questions-batch.json`

**Bridge de inputs/outputs:**

| De Fase 03 | A Fase 04 |
|------------|-----------|
| Schema con 6 tablas creadas | Fase 04 inserta preguntas en las tablas |
| Migraciones aplicadas a Neon | BD lista para recibir datos |
| `wipe-and-seed.js` corre limpio | Script idempotente se puede correr multiples veces |

---

### Paso 10: Verificar la conexion y las tablas

Que hacer:

1. **Verificar que las 6 tablas existen en Neon**:

    ```bash
    cd backend
    node -e "(async () => { const {db} = await import('./src/config/database.js'); const {sql} = await import('drizzle-orm'); const r = await db.execute(sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\`); console.log('Tablas en Neon:', r.rows.map(x => x.table_name)); })().catch(e => { console.error(e); process.exit(1); })"
    ```

    Debe listar: `questions, quiz_questions, quizzes, session, submissions, users`.

2. **Probar un query basico**:

    ```bash
    node -e "(async () => { const {db} = await import('./src/config/database.js'); const {sql} = await import('drizzle-orm'); const r = await db.execute(sql\`SELECT COUNT(*) as total FROM users\`); console.log('Usuarios:', r.rows[0]); })().catch(e => { console.error(e); process.exit(1); })"
    ```

    Debe mostrar `{ total: 0 }` (tabla vacia, todavia no se cargo el seed).

---

## Checklist de verificacion

- [ ] Schema definido con todas las tablas y relaciones
- [ ] Columnas con nombres correctos en BD (snake_case)
- [ ] Foreign Keys creadas con .references()
- [ ] Unique constraints en username email hash
- [ ] Campo role en users con default 'user'
- [ ] Campo is_active en questions con default true (soft delete para Fases 13 y 14)
- [ ] Tabla session creada (requerida por Fase 6 para sesiones en Vercel)
- [ ] Migraciones generadas sin errores
- [ ] Migraciones aplicadas a Neon
- [ ] Conexion a BD verificada
- [ ] Puedes hacer db.execute(SELECT 1) exitosamente
- [ ] (Opcional) El primer admin sera creado automaticamente por `bootstrapAdmin()` al arrancar el server (ver Fase 05), usando `ADMIN_USERNAME` y `ADMIN_PASSWORD` del `.env`. Si queres promover uno manualmente antes, ejecutar: `UPDATE users SET role='admin' WHERE email='tu@email.com';`

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| `DATABASE_URL is not set in environment variables` | Variable no definida en `.env` o el archivo no se cargo (verificar `import 'dotenv/config'` en `config/database.js`) |
| no pg_hba.conf entry | Falta SSL en la conexion |
| relation does not exist | Migraciones no aplicadas |
| null value in column hash | Olvidaste pasar hash al insertar |
| duplicate key value | Unique constraint sin manejo |
| Connection timeout / ECONNREFUSED | Neon inaccesible: revisar region del endpoint, IP allowlist en Neon Console, o plan expirado |
| Cannot find module drizzle-orm | No instalaste `pg drizzle-orm` en el Paso 1 |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Drizzle schema | Define la estructura completa de la BD desde codigo |
| Foreign Keys | Mantienen integridad referencial entre tablas |
| Migraciones | Versionan cambios en BD permiten colaboracion |
| Connection Pool | Reutiliza conexiones no satura la BD |
| Neon SSL | Obligatorio para conectar a Neon |
| Unique constraints | Previenen duplicados a nivel BD |