# Fase 7: CRUD de Preguntas Manuales

## Objetivo
Crear un sistema para agregar y gestionar preguntas de quiz manualmente en la base de datos. Las preguntas se crean por ti (no por IA) y se almacenan para que el sistema las sirva a los usuarios.

---

### Paso 1: Crear esquema de preguntas seed

Que hacer:
1. Crear una tabla de seed en src/seeds/ o un archivo JSON con preguntas de ejemplo
2. Cada pregunta debe tener: title description difficulty starterCode testsTemplate categoryId
3. Empezar con 5-10 preguntas por categoria como minimo
4. Cada pregunta debe tener testsTemplate con al menos 2-3 tests

Pistas:
- El seed es la forma mas rapida de tener datos para probar. Luego puedes crear un endpoint CRUD o un script para agregar mas.
- Las preguntas seed deben ser realistas y tener tests que funcionen. Si los tests fallan el usuario va a pensar que el sistema esta roto.
- Organiza las preguntas por tecnologia y categoria para facilitar la insercion.
- El campo hash se calcula automaticamente (title + description). No lo pongas en el seed manualmente, calculalo al insertar.

Que estudiar:
- Estructura de datos para preguntas de programacion
- Como diseñar testsTemplate: input vs expected vs description
- Diferencia entre tests unitarios y tests de integracion para quizzes

---

### Paso 2: Crear funcion de insercion de preguntas

Que hacer:
En src/seeds/seed.js (o un archivo dedicado) crear funcion addQuestions(questions) que:
1. Reciba un array de objetos con la estructura de pregunta
2. Para cada pregunta:
   - Calcular hash MD5 de title + description
   - Verificar si ya existe pregunta con ese hash
   - Si no existe: insertar en questions con categoryId
   - Si existe: skipear (no duplicar)
3. Retornar cantidad de preguntas insertadas

Pistas:
- Reutiliza la logica de dedup por hash que ya teniamos en la Fase original.
- La funcion debe ser idempotente: ejecutarla multiples veces no debe duplicar datos.
- Si la pregunta no tiene categoryId, busca la categoria por nombre.

Que estudiar:
- Drizzle insert con returning()
- Dedup por hash: patron comun en applications
- Idempotencia en scripts de seed

---

### Paso 3: Crear endpoint de gestion de preguntas (opcional)

Que hacer:
Crear en questions.routes.js:
1. GET /questions - listar todas las preguntas (con filtros opcionales: technology category difficulty)
2. POST /questions - crear una pregunta nueva (protegido con auth)
3. PUT /questions/:id - actualizar una pregunta existente (protegido)
4. DELETE /questions/:id - eliminar una pregunta (protegido)

Crear en questions.controller.js:
1. getQuestions - query con filtros y paginacion basica
2. createQuestion - validacion de campos requeridos + calculo de hash
3. updateQuestion - solo campos modificables (no categoryId)
4. deleteQuestion - soft delete (marcar como inactiva) o hard delete

Pistas:
- Estos endpoints son para administracion no para el usuario final. Ponlos protegidos con auth.
- El GET /questions es publico si quieres mostrar catalogo de preguntas disponibles.
- La paginacion es importante: no devuelvas 1000 preguntas de una. Usa limit y offset.
- Soft delete es mas seguro: la pregunta no se pierde sino que se marca como inactiva.

Que estudiar:
- REST API CRUD: GET POST PUT DELETE
- Paginacion: limit offset total en respuesta
- Soft delete vs hard delete: ventajas y desventajas
- Validacion de entrada: campos requeridos tipos formatos

---

### Paso 4: Crear script de carga masiva (opcional)

Que hacer:
Crear src/seeds/bulk-load.js que:
1. Lea un archivo JSON con preguntas
2. Valide la estructura de cada pregunta
3. Inserte en lote usando batch insert
4. Reporte resultados (insertadas duplicadas errores)

Pistas:
- Un archivo JSON es la forma mas simple de compartir preguntas entre desarrolladores.
- El JSON puede tener esta estructura: { technology: "JavaScript", category: "Arrays", questions: [...] }
- El batch insert es mas rapido que inserts individuales pero mas complejo de manejar errores.
- Si una pregunta falla la validacion skipea y continua con las demas no detengas todo.

Que estudiar:
- Lectura de archivos en Node: fs.readFile con promesas
- Batch inserts en Drizzle: insercion multiples en una query
- Validacion de JSON: schema validation con Joi o Zod (opcional)

---

### Paso 5: Verificar que las preguntas se sirven correctamente

Que hacer:
1. Insertar preguntas de ejemplo (via seed o endpoint)
2. Iniciar servidor
3. Hacer POST a /api/quizzes/generate con tecnologia y categoria
4. Verificar que devuelve preguntas de las que insertaste
5. Verificar que GET /api/quizzes/:id/current devuelve la primera pregunta

Pistas:
- Si el endpoint no devuelve preguntas verifica: (1) las preguntas tienen categoryId correcto (2) la categoria existe en BD (3) la query filtra correctamente.
- El generateQuiz ahora solo busca preguntas existentes no genera nuevas.

---

## Checklist de verificacion

- [ ] Preguntas insertadas en BD correctamente
- [ ] Hash calculado automaticamente para cada pregunta
- [ ] Dedup funciona: ejecutar seed dos veces no duplica
- [ ] GET /questions devuelve preguntas con filtros
- [ ] POST /questions crea pregunta nueva
- [ ] Quiz generate devuelve preguntas predefinidas
- [ ] Tests de ejemplo pasan cuando el codigo es correcto

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Preguntas no aparecen | categoryId incorrecto o categoria no existe |
| TestsTemplate invalido | JSON malformado o estructura incorrecta |
| Hash duplicado | Preguntas con mismo title+description |
| 401 al crear pregunta | Auth no configurado o ruta no protegida |
| Paginacion no funciona | limit/offset no se pasan a la query |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Seed data | Poblacion inicial de preguntas para desarrollo |
| CRUD endpoints | Gestion de contenido desde el navegador |
| Paginacion | No sobrecargar respuestas con muchos datos |
| Soft delete | Preservar datos en vez de eliminarlos |
| Batch inserts | Insercion eficiente de multiples registros |