# Fase 2: Database Schema y Conexion a Neon

## Objetivo
Definir todas las tablas del proyecto usando Drizzle ORM, conectar a Neon (PostgreSQL serverless) y generar la primera migracion. Al finalizar tu base de datos deberia tener las 7 tablas creadas.

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

Que hacer:
Crear drizzle.config.js en la raiz de backend/ con:
- schema: ruta al archivo de schema (./src/drizzle/schema.js)
- out: carpeta de salida de migraciones (./drizzle)
- dialect: postgresql
- dbCredentials.url: process.env.DATABASE_URL

Pistas:
- En versiones recientes de Drizzle se usa dialect: postgresql en vez de driver pg. Revisa la documentacion actual al momento de hacerlo.
- El connectionString o url se lee desde process.env asi que necesitas que las variables de entorno esten cargadas. Drizzle Kit no usa dotenv automaticamente.
- schema apunta a un archivo que aun no existe. Lo crearas en el Paso 3.

Que estudiar:
- Drizzle Config - todas las opciones disponibles
- Que es dialect y por que se especifica
- Diferencia entre driver (versiones antiguas) y dialect (versiones recientes)

---

### Paso 3: Definir schema completo

Que hacer:
Crear src/drizzle/schema.js con las siguientes tablas usando pgTable de drizzle-orm/pg-core:

1. users: id (serial PK), email (varchar 255 unique not null), name (varchar 255), googleId (varchar 255 unique), role (varchar 20 not null default 'user', valores: 'user' | 'admin'), createdAt (timestamp defaultNow)

2. technologies: id (serial PK), name (varchar 100 not null unique), icon (varchar 50), description (text)

3. categories: id (serial PK), technologyId (integer FK a technologies.id not null), name (varchar 100 not null), description (text)

4. questions: id (serial PK), categoryId (integer FK a categories.id not null), difficulty (integer not null), title (varchar 255 not null), description (text not null), starterCode (text not null columna starter_code), testsTemplate (json not null columna tests_template), isActive (boolean not null default true columna is_active), hash (varchar 32 unique not null), createdAt (timestamp defaultNow)

5. quizzes: id (serial PK), userId (integer FK a users.id nullable), technologyId (integer FK a technologies.id not null), categoryId (integer FK a categories.id nullable), startedAt (timestamp defaultNow), completedAt (timestamp nullable)

6. quizQuestions (tabla pivote many-to-many): id (serial PK), quizId (integer FK a quizzes.id not null), questionId (integer FK a questions.id not null), order (integer not null)

7. submissions: id (serial PK), quizQuestionId (integer FK a quizQuestions.id not null), code (text not null), sandboxResults (json nullable columna sandbox_results con stdout stderr status), score (integer nullable), evaluatedAt (timestamp nullable columna evaluated_at)

8. session (usada por `connect-pg-simple` para sesiones en Vercel): sid (varchar not null PK columna sid), sess (json not null columna sess), expire (timestamp not null columna expire)

Pistas:
- El nombre de la columna en JS (camelCase) puede ser diferente al nombre en BD (snake_case). Usa el segundo parametro de pgTable: varchar('column_name_in_db', length: 255).
- Todas las FK deben tener .notNull() EXCEPTO userId en quizzes (un quiz puede ser anonimo) y categoryId en quizzes (categoria opcional).
- hash es un MD5 de title+description. Se usa para evitar preguntas duplicadas. Sin unique constraint en hash la deduplicacion no funciona.
- defaultNow() se traduce a DEFAULT NOW() en PostgreSQL.
- Las relaciones (FKs) se definen con .references(() => otraTabla.id).
- testsTemplate es JSON porque almacena un array de objetos de prueba ({input expected}). Drizzle lo maneja como json type.

Que estudiar:
- Drizzle schema: tipos de columna (serial varchar text integer json timestamp)
- references() - Foreign Keys integridad referencial
- unique() - que pasa si intentas insertar un duplicado
- defaultNow() - timestamps automaticos
- camelCase en JS vs snake_case en BD - mapeo de nombres
- json type en PostgreSQL vs JSONB - diferencias

---

### Paso 4: Configurar conexion a base de datos

Que hacer:
Crear src/config/database.js que:
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
1. Crear un script temporal test-db.js que importe db y ejecute db.execute SELECT 1
2. Ejecutarlo con node test-db.js
3. Si funciona eliminar el script temporal

Pistas:
- Si la conexion falla revisa: (1) DATABASE_URL tiene el formato correcto (2) Neon acepta conexiones desde tu IP (3) SSL esta configurado.
- db.execute(SELECT 1) es la forma mas simple de verificar que la conexion esta viva.
- No dejes scripts temporales en el proyecto. Eliminalos despues de probar.

Que estudiar:
- db.execute() vs db.query() vs db.select() en Drizzle
- Formato de connection string de Neon: postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require

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

## Checklist de verificacion

- [ ] Schema definido con todas las tablas y relaciones
- [ ] Columnas con nombres correctos en BD (snake_case)
- [ ] Foreign Keys creadas con .references()
- [ ] Unique constraints en email googleId name (technologies) hash
- [ ] Campo role en users con default 'user'
- [ ] Campo is_active en questions con default true (soft delete para Fases 13 y 14)
- [ ] Tabla session creada (requerida por Fase 6 para sesiones en Vercel)
- [ ] Migraciones generadas sin errores
- [ ] Migraciones aplicadas a Neon
- [ ] Conexion a BD verificada
- [ ] Puedes hacer db.execute(SELECT 1) exitosamente
- [ ] Primer admin promovido manualmente: `UPDATE users SET role='admin' WHERE email='tu@email.com';`

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| no pg_hba.conf entry | Falta SSL en la conexion |
| relation does not exist | Migraciones no aplicadas |
| null value in column hash | Olvidaste pasar hash al insertar |
| duplicate key value | Unique constraint sin manejo |
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