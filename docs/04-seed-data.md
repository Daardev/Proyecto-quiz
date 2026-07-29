# Fase 3: Seed Data y Preguntas Iniciales

## Objetivo
Poblar la base de datos con tecnologias categorias y preguntas iniciales. Esta fase te da el primer quick win - algo visible que puedas llamar con el navegador.

---

### Paso 1: Crear seed script para tecnologias

Que hacer:
Crear src/seeds/seed.js que inserte:
- JavaScript (icon: unicode cuadrado amarillo, description: Lenguaje de programacion)
- Node.js (icon: unicode cuadrado verde, description: Runtime de JavaScript para backend)
- PostgreSQL (icon: unicode cuadrado azul, description: Base de datos relacional SQL)

Pistas:
- Usa db.insert(technologies).values([...]).onConflictDoNothing() para evitar duplicados si ejecutas el seed mas de una vez.
- onConflictDoNothing() solo funciona si hay una unique constraint en la columna name. Si no la pusiste en la Fase 2 el seed fallara con duplicados en la segunda ejecucion.
- La estructura de values() debe coincidir exactamente con el schema (mismos nombres de columnas en JS).

Que estudiar:
- Drizzle insert: insercion simple vs batch insert
- onConflictDoNothing() vs onConflictDoUpdate() - diferencias
- Como hacer seeds idempotentes

---

### Paso 2: Crear seed script para categorias

Que hacer:
Agregar al mismo seed.js la insercion de categorias por tecnologia:

JavaScript (8 categorias): DOM Asincronia Arrays Variables/Scope Closures Prototypes ES6+ Error Handling

Node.js (7 categorias): File System HTTP/Server Express/Middleware Events Streams NPM/Modules Environment Variables

PostgreSQL (7 categorias): Queries basicas JOINS Subqueries Indices Normalizacion Functions Triggers

Pistas:
- Antes de insertar categorias necesitas obtener los IDs de las tecnologias insertadas. Usa db.query.technologies.findFirst({ where: ... }).
- Las categorias dependen de technologyId (FK). Si el seed de tecnologias no se ejecuta primero las categorias fallaran por violacion de FK.
- El orden importa: tecnologias luego categorias.
- Al igual que tecnologias usa onConflictDoNothing() para que el seed sea idempotente.

Que estudiar:
- Orden de insercion con dependencias de FK
- findFirst() con where - filtros en Drizzle
- Como hacer que el seed sea ejecutable multiples veces sin errores

---

### Paso 3: Crear seed de preguntas iniciales

Que hacer:
Crear un archivo src/seeds/questions.seed.js con 5-10 preguntas de ejemplo por categoria:

Para JavaScript/Arrays por ejemplo:
1. "Suma de array" - funcion que sume todos los elementos
2. "Filtrar pares" - funcion que devuelva solo numeros pares
3. "Encontrar maximo" - funcion que encuentre el valor mas alto
4. "Invertir array" - funcion que invierta el orden
5. "Eliminar duplicados" - funcion que devuelva elementos unicos

Cada pregunta debe tener:
- title: titulo corto descriptivo
- description: enunciado claro de que debe hacer el codigo
- starterCode: codigo base donde el usuario empieza (con comentarios guia)
- testsTemplate: array de 2-3 tests con input y expected
- difficulty: 1 facil 2 medio 3 dificil
- categoryId: ID de la categoria correspondiente

Pistas:
- El starterCode debe tener la funcion declarada pero vacia o con return placeholder. Ej: function sum(arr) { // Tu codigo aqui }
- Los tests deben ser simples y claros. Ej: input: [1,2,3] expected: 6
- Para obtener categoryId busca la categoria por nombre y tecnologia.
- El hash se calcula automaticamente con title+description. No lo pongas manualmente.
- Empieza con solo 2-3 categorias para probar. No necesitas llenar todas las 22 categorias de una.

Que estudiar:
- Diseno de preguntas de programacion: que hace una buena pregunta
- Estructura de tests: input vs expected vs description
- starterCode: como guiar al usuario sin dar la respuesta

---

### Paso 4: Ejecutar seed completo

Que hacer:
1. Agregar scripts en package.json:
   - seed: node src/seeds/seed.js (solo tecnologias y categorias)
   - seed:questions: node src/seeds/questions.seed.js (solo preguntas)
   - seed:all: node src/seeds/seed.js && node src/seeds/questions.seed.js (todo)
2. Ejecutar npm run seed:all
3. Verificar en BD que las tablas tienen datos

Pistas:
- El seed de preguntas DEBE ejecutarse DESPUES del seed de technologias y categorias porque necesita los IDs.
- Si el seed falla por connection refused la BD no esta corriendo o la URL es incorrecta.
- Si falla por relation technologies does not exist las migraciones no se aplicaron (vuelve a Fase 2).
- Para verificar puedes conectarte a Neon Console y hacer SELECT count(*) FROM questions.

Que estudiar:
- Neon Console - interfaz web para ver datos
- SELECT basico en PostgreSQL: count where join
- Como debuggear errores de conexion y migraciones

---

### Paso 5: Crear ruta GET /api/technologies

Que hacer:
1. En questions.controller.js crear funcion getTechnologies que haga db.query.technologies.findMany({ with: { categories: true } }) y devuelva JSON.
2. En questions.routes.js crear ruta router.get('/technologies', getTechnologies).
3. En app.js importar y montar questionsRoutes en /api.

Pistas:
- El with clause en Drizzle es similar a un JOIN. Sin el solo obtienes las tecnologias sin sus categorias.
- La ruta es /api/technologies no /technologies. El prefijo /api se define en app.use('/api', questionsRoutes).
- No necesitas autenticacion para este endpoint - es publico. Sin middleware de auth cualquier request llega al controlador.

Que estudiar:
- Drizzle relations: with clause eager loading vs lazy loading
- Express Router montado con prefijo - como funciona el anidamiento
- res.json() - formato de respuesta status codes

---

### Paso 6: Probar endpoint

Que hacer:
1. Iniciar servidor con npm run dev
2. Abrir navegador en http://localhost:3001/api/technologies
3. Verificar que devuelve JSON con tecnologias y sus categorias anidadas
4. Verificar que hay preguntas en la BD con SELECT count(*) FROM questions

Pistas:
- Si ves {} vacio probablemente el seed no se ejecuto o la conexion a BD falla.
- Si ves Cannot GET /api/technologies la ruta no esta montada correctamente en app.js.
- Si ves HTML en vez de JSON falta express.json() middleware o la respuesta esta usando res.send() en vez de res.json().

Que estudiar:
- Debugging de rutas Express - como saber si una ruta esta registrada
- Diferencia entre res.json() res.send() res.render()
- Formato JSON en respuestas API

---

## Checklist de verificacion

- [ ] Seed de tecnologias ejecutado sin errores
- [ ] Seed de categorias ejecutado sin errores
- [ ] Seed de preguntas ejecutado sin errores
- [ ] Datos visibles en Neon Console
- [ ] GET /api/technologies devuelve JSON con tecnologias y categorias
- [ ] Hay al menos 5 preguntas por categoria de prueba en BD
- [ ] Seed es idempotente (ejecutarlo dos veces no da error ni duplica datos)

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| relation technologies does not exist | Migraciones no aplicadas |
| onConflictDoNothing is not a function | Version antigua de Drizzle o falta unique |
| Seed ejecutado pero endpoint vacio | Conexion a BD distinta entre seed y app |
| TypeError Cannot read properties | Ruta del import en app.js esta mal |
| FK violation al insertar preguntas | CategoryId incorrecto o categoria no existe |
| Tests fallan al ejecutar | starterCode o testsTemplate mal diseados |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Database seeding | Poblacion inicial de datos para desarrollo |
| Drizzle with clause | Hace JOINs de forma declarativa |
| Router con prefijo | Organizacion de endpoints por modulo |
| Idempotencia | El seed debe poder ejecutarse multiples veces |
| Diseno de tests | Tests claros y simples para evaluar codigo |
| starterCode | Guia al usuario sin dar la respuesta |