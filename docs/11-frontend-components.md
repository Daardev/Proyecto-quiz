# Fase 9: Frontend - Componentes Interactivos

## Objetivo
Agregar interactividad real: Monaco Editor para escribir codigo timer con cuenta regresiva navegacion entre preguntas y el flujo completo funcional. Esta fase completa el proyecto.

---

### Paso 1: Implementar CodeEditor component

Que hacer:
Crear src/components/code-editor.js con:
1. Clase CodeEditor que recibe containerId y opciones (language theme value)
2. Metodo init() que:
   - Carga Monaco desde CDN (creando script tag dinamicamente)
   - Configura require paths
   - Crea el editor en el contenedor
   - Configura: language theme vs-dark automaticLayout lineNumbers minimap desactivado
3. Metodo getValue() -> retorna el codigo del editor
4. Metodo setValue(code) -> setea codigo en el editor
5. Metodo destroy() -> dispose del editor (cleanup)
6. Estado de cargando mientras Monaco se descarga

Pistas:
- Monaco desde CDN: https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js
- Monaco es grande (aprox 10MB). La primera carga puede ser lenta. Muestra un Cargando editor... mientras.
- automaticLayout: true hace que Monaco se redimensione solo cuando el contenedor cambia de tamano.
- Desactiva el minimap (mapa de codigo a la derecha) para un look mas limpio.
- readOnly: false es el default pero se explicito.

Que estudiar:
- Monaco Editor: cargar desde CDN crear editor opciones
- CDN loading: script onload require.config paths
- Monaco options: language theme automaticLayout minimap lineNumbers
- Cleanup: dispose del editor cuando la pagina se cierra

---

### Paso 2: Implementar QuizTimer component

Que hacer:
Crear src/components/timer.js con:
1. Clase QuizTimer que recibe containerId y opciones (totalTime = 300s timePerQuestion = 10s)
2. Estado: remainingTime intervalId
3. Metodo start():
   - Inicia setInterval de 1 segundo
   - Cada tick: decrementa remainingTime actualiza display
   - Si remainingTime llega a 0: llama onTimeout detiene timer
4. Metodo stop(): clearInterval
5. Metodo addTime(seconds): agrega tiempo por pregunta respondida
6. Metodo getTimeRemaining(): retorna segundos restantes
7. Metodo updateDisplay():
   - Formatea como MM:SS
   - Cambia clase CSS segun tiempo: normal mas de 60s warning menos de 60s danger menos de 30s
8. Evento: onTimeout (callback que se ejecuta al llegar a 0)

Pistas:
- setInterval no es preciso para contar tiempo real. Si la pagina se congela el timer no avanza. Para mayor precision usa Date.now() y calcula diferencia.
- El timer debe DETENERSE cuando el usuario envia respuesta o salta. No debe seguir corriendo en background.
- addTime se llama cuando el usuario responde una pregunta (timePerQuestion). Asi el timer total es 5 min + 10s por pregunta respondida.
- onTimeout debe forzar el envio del quiz actual (lo que tenga respondido) y redirigir a resultados.

Que estudiar:
- setInterval: funcionamiento cleanup (clearInterval)
- Date.now() para tiempo real vs setInterval (drift)
- Formateo de tiempo: Math.floor padStart
- Callback pattern: onTimeout eventos personalizados

---

### Paso 3: Implementar QuizNavigation component

Que hacer:
Crear src/components/quiz-navigation.js con:
1. Clase QuizNavigation que recibe opciones (totalQuestions currentIndex onChange)
2. Metodo render(containerId):
   - Crea barra de progreso: Pregunta X de Y
   - Botones Anterior y Siguiente (deshabilitados en bordes)
   - Miniaturas numeradas (circulos con numero) cada una con estado:
     - Azul = actual
     - Verde = respondida
     - Gris = no respondida
     - Rojo = saltada
3. Metodo updateState(questionsState):
   - Recibe array con estados de cada pregunta
   - Actualiza colores de miniaturas
4. Eventos: click en miniatura o en Anterior/Siguiente -> onChange(index)

Pistas:
- Las miniaturas son botones circulares numerados. El usuario puede hacer click en cualquiera para ir a esa pregunta.
- La navegacion NO debe permitir avanzar sin responder (opcional). Decide si quieres forzar respuesta o permitir skip.
- onChange recibe el nuevo indice. El componente NO controla que pregunta se muestra solo notifica.
- Las preguntas saltadas tienen estado skipped y se muestran en rojo.

Que estudiar:
- Componente de navegacion: UI de progress indicadores de estado
- Event delegation: un solo listener vs multiples listeners
- Estado visual: clases CSS por estado (respondida actual saltada pendiente)
- Botones deshabilitados: disabled attribute estilos visuales

---

### Paso 4: Integrar todo en quiz.html

Que hacer:
Reemplazar el script inline de quiz.html con:
1. Importar CodeEditor QuizTimer ApiClient
2. Al cargar la pagina:
   - Leer quizId de URL
   - Inicializar CodeEditor (aun sin valor)
   - Inicializar QuizTimer y start()
   - Cargar primera pregunta
3. Funcion loadQuestion():
   - Fetch a getCurrentQuestion
   - Mostrar titulo descripcion
   - Setear starterCode en editor
   - Si { done: true } redirigir a results.html
4. Funcion submitAnswer():
   - Obtener codigo del editor
   - Llamar a api.submitAnswer()
   - Mostrar feedback: tests pasados y fallados
   - Actualizar estado en QuizNavigation
   - Llamar a timer.addTime()
   - Cargar siguiente o redirigir a resultados
5. Funcion skipQuestion():
   - Marcar como saltada en QuizNavigation
   - Cargar siguiente pregunta
   - No guardar nada en BD

Pistas:
- El componente QuizNavigation necesita saber el total de preguntas. Puedes obtenerlo de la respuesta de generateQuiz guardada en sessionStorage.
- Guarda el estado del quiz en una variable global (no BD) para saber que preguntas estan respondidas/saltadas durante la sesion.
- El editor debe deshabilitarse despues de enviar respuesta (readOnly: true).
- Despues de mostrar feedback el usuario debe hacer clic en Siguiente para continuar. No automatices la transicion.
- El endpoint de submit usa /submit (singular) segun el spec. Asegurate que api-client.js apunte a esa ruta.

Que estudiar:
- Comunicacion entre componentes: estado compartido eventos
- sessionStorage vs localStorage: persistencia por pestana vs persistencia global
- Estados del editor: readOnly limpiar entre preguntas
- Flujo de quiz: maquina de estados explicita (loading -> answering -> submitted -> feedback -> next)

---

### Paso 5: Implementar results.html con datos reales

Que hacer:
Reemplazar script inline de results.html:
1. Importar ApiClient
2. Al cargar: fetch a getResults(quizId)
3. Mostrar:
   - Score total (formato grande con animacion de conteo opcional)
   - Lista de preguntas con:
     - Titulo
     - Score individual (tests pasados / total)
     - Codigo enviado en pre/code
     - Tests pasados (verde) y fallados (rojo) con detalle expected vs stdout
   - Boton Nuevo Quiz -> index.html

Pistas:
- El feedback se basa en los tests: muestra los tests pasados y fallados con el detalle de expected vs stdout.
- El score total se puede animar con un contador de 0 hasta el score (setInterval con incrementos). Es un detalle visual simple pero impactante.
- Si no hay resultados (error) muestra pantalla de error con opcion de reintentar.
- Para cada test fallado muestra que esperaba el test y que devolvio el codigo del usuario.

Que estudiar:
- Renderizado seguro: innerHTML vs textContent (XSS prevention)
- Animacion basica: setInterval para conteo de score
- Estado de error en frontend: mensajes amigables botones de accion
- Comparacion visual de codigo: resaltar diferencias

---

### Paso 6: Probar flujo completo end-to-end

Que hacer:
1. Abrir index.html
2. Seleccionar tecnologia -> categoria -> dificultad -> cantidad
3. Hacer clic en Iniciar Quiz
4. Verificar redireccion a quiz.html con quizId en URL
5. Verificar que Monaco Editor carga y muestra el starter code
6. Verificar que el timer inicia
7. Escribir codigo en el editor
8. Enviar respuesta
9. Verificar feedback (puede tardar por Judge0/sandbox)
10. Navegar a siguiente pregunta
11. Repetir hasta terminar
12. Verificar redireccion a results.html
13. Verificar scores y feedback por pregunta

Pistas:
- Si Monaco no carga revisa la consola del navegador. Posible error de CORS en el CDN.
- Si el feedback no llega probablemente el sandbox no esta configurado. Revisa los logs del backend.
- Si los scores son siempre 0 el sandbox esta fallando. Verifica Judge0.
- El flujo completo es largo. Prueba primero con count=2 preguntas para debuggear rapido.

---

### Paso 7: Agregar manejo de errores global

Que hacer:
1. Agregar bloque try/catch alrededor de todas las llamadas a API
2. Mostrar errores al usuario (no solo console.error)
3. Manejar casos:
   - Backend no disponible: Servicio no disponible. Intenta mas tarde.
   - No autenticado: Debes iniciar sesion. + boton de login
   - Error de red: Error de conexion. Verifica tu internet.
   - Sandbox no disponible: No se pudo evaluar el codigo. Intenta mas tarde.

Pistas:
- Los errores deben mostrarse in-page no con alert(). Crea un div de error al inicio del body.
- Separa errores recuperables (reintentar) de no recuperables (redirigir a login).
- El usuario final no necesita ver stack traces. Mensajes claros y accion sugerida.

Que estudiar:
- Error handling en frontend: UX de errores mensajes amigables
- Diferencia entre errores de red errores HTTP y errores de logica
- Toast/notificaciones vs alert() vs errores inline

---

## Checklist de verificacion final

- [ ] Monaco Editor carga y funciona
- [ ] Timer cuenta regresivamente y cambia color
- [ ] Navegacion permite ir entre preguntas
- [ ] Enviar respuesta muestra tests pasados/fallados
- [ ] Saltar pregunta avanza sin guardar
- [ ] Timeout del timer redirige a resultados
- [ ] Resultados muestran scores y detalle de tests
- [ ] Boton Nuevo Quiz vuelve al inicio
- [ ] Errores se muestran al usuario
- [ ] Sin errores en consola del navegador

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Monaco no carga | CDN bloqueado script sin onload handler |
| fetch falla con CORS | credentials no incluido backend sin CORS |
| Timer no se detiene | No se llamo stop() al enviar respuesta |
| Feedback no aparece | Feedback div sin clase .hidden removida |
| Navegacion no actualiza | QuizNavigation no recibe nuevo estado |
| Scores no se muestran | getResults no se llamo o devolvio error |
| Tests no comparan bien | stdout tiene espacios o saltos extra |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Monaco Editor | Editor de codigo profesional en el browser |
| Componentes JS | Encapsulacion de UI en clases reutilizables |
| Timer/interval | Gestion de tiempo en el navegador |
| Maquina de estados del quiz | Flujo ordenado: carga responde feedback siguiente |
| Error handling en frontend | UX profesional no alert() |
| Comunicacion entre componentes | Estado compartido sin framework |