# Fase 8: Frontend - Paginas y Estilos

## Objetivo
Crear la interfaz de usuario con paginas renderizadas con Handlebars desde el backend, CSS con tema oscuro y el cliente API para componentes interactivos del lado cliente. Al finalizar las paginas (selector quiz resultados) deben verse bien y navegar entre si.

IMPORTANTE: El spec usa Handlebars para TODAS las paginas (no HTML vanilla). Las vistas se crean en `backend/src/views/pages/` como archivos `.hbs` y se renderizan con `res.render()`. Los componentes JS de frontend (`code-editor.js` `timer.js` `quiz-navigation.js`) solo se usan dentro de paginas HBS que necesitan interactividad en el cliente (ej: Monaco Editor en quiz.hbs).

---

### Paso 1: Crear estructura del frontend

Que hacer:
Estructura del proyecto:
- `backend/src/views/pages/` — vistas Handlebars (index.hbs quiz.hbs results.hbs profile.hbs dashboard.hbs)
- `backend/src/views/layouts/` — layouts (main.hbs)
- `backend/src/views/partials/` — partials (navbar.hbs en Fase 10)
- `frontend/public/styles/main.css` — CSS vanilla global (servido estaticamente)
- `frontend/src/components/` — modulos JS opcionales para interactividad (Monaco Timer etc)
- `frontend/src/lib/api-client.js` — Fetch helper (usado por JS del cliente en paginas con interactividad)

Pistas:
- El CSS se sirve desde `frontend/public/` con `express.static()`. Los archivos alli son accesibles desde `/styles/main.css`.
- Las paginas HBS NO son HTML estatico: son templates que el backend renderiza. NO las pongas en `frontend/src/pages/`.
- Los componentes JS (`code-editor.js` etc) se sirven desde `frontend/src/` y se importan como ES modules desde las paginas HBS.
- `api-client.js` solo es necesario si hay JS del cliente que llama al backend (caso: quiz.hbs necesita enviar codigo a `/api/quizzes/:id/submit`).
- package.json del frontend es opcional (no tiene dependencias de build es vanilla). Pero crealo por si luego agregas tooling.

Que estudiar:
- Diferencia entre renderizado server-side (Handlebars) y client-side (JS+DOM)
- Por que el backend renderiza las vistas y el cliente solo aporta interactividad
- Archivos estaticos en Express: express.static()
- ES modules en el navegador: `<script type="module" src="...">`

---

### Paso 2: Crear main.css

Que hacer:
Crear public/styles/main.css con:
1. Reset CSS basico (box-sizing margin padding)
2. Tema oscuro: fondo #1a1a2e texto #eee
3. Layout: container centrado con max-width 900px
4. Formularios: select input button estilizados
5. Tipografia: system font stack (-apple-system BlinkMacSystemFont Segoe UI Roboto)
6. Timer: clases .timer (normal) .timer.warning (color dorado) .timer.danger (color rojo)
7. Editor de codigo: contenedor de 400px height borde redondeado
8. Feedback cards: fondo mas claro (#2a2a4e) padding border-radius
9. Botones: primario (celeste #00d9ff) secundario (gris)
10. Media queries para mobile (max-width: 768px)

Pistas:
- Usa variables CSS para los colores principales. Asi puedes cambiar el tema completo editando solo las variables.
- El disenio debe ser mobile-first o al menos responsive. Los quizzes se pueden hacer desde el celular.
- No uses frameworks CSS (Tailwind Bootstrap). El spec dice CSS vanilla.
- Los botones deben tener hover states. Sin feedback visual la UI se siente muerta.
- El contenedor del editor debe tener altura fija (400px) para que Monaco se renderice correctamente.

Que estudiar:
- CSS custom properties (variables): --primary #00d9ff
- CSS reset: box-sizing margin/padding reset
- Flexbox: centrado vertical y horizontal layout responsive
- Media queries: @media (max-width: 768px)
- Dark theme: paleta de colores contraste accesibilidad (WCAG)
- System font stack: por que es mejor que cargar una fuente

---

### Paso 3: Crear api-client.js

Que hacer:
Crear src/lib/api-client.js con:
1. Clase ApiClient con baseURL = '/api'
2. Metodo privado request(endpoint options) que:
   - Hace fetch con credentials: 'include'
   - Setea Content-Type: application/json
   - Maneja errores HTTP (response.ok === false)
   - Retorna JSON parseado
3. Metodos publicos:
   - getMe() -> GET /auth/me
   - logout() -> POST /auth/logout
   - getTechnologies() -> GET /technologies
   - generateQuiz(data) -> POST /quizzes/generate
   - getCurrentQuestion(quizId) -> GET /quizzes/{id}/current
   - submitAnswer(quizId data) -> POST /quizzes/{id}/submit
   - getResults(quizId) -> GET /quizzes/{id}/results
4. Exportar instancia unica (singleton)

Pistas:
- credentials: 'include' es OBLIGATORIO para que las cookies de sesion se envien al backend. Sin esto el auth no funciona.
- El manejo de errores debe ser informativo: lanza un Error con el mensaje del backend o el status text.
- No hardcodees la URL base. Usa /api (relativo) para que funcione tanto en desarrollo como en produccion.
- La instancia singleton evita crear multiples clientes con configuraciones diferentes.

Que estudiar:
- Fetch API: GET POST headers credentials
- HTTP error handling: response.ok response.status response.statusText
- Singleton pattern: por que una sola instancia
- Cookies de sesion: como funcionan cross-origin (CORS + credentials)

---

### Paso 4: Crear vista index.hbs (Selector de quiz)

Que hacer:
Crear `backend/src/views/pages/index.hbs`:
1. Extiende layout `main.hbs` (automatico con express-handlebars)
2. Formulario con:
   - Select de tecnologia (renderizado desde backend con datos de BD)
   - Select de categoria (cambia segun tecnologia — se llena desde JS del cliente)
   - Select de dificultad (Facil 1 Medio 2 Dificil 3)
   - Input numerico de cantidad de preguntas (1-20 default 10)
   - Boton Iniciar Quiz
3. Script JS del cliente (type module) que:
   - Al cargar: fetch a `/api/technologies` para confirmar (opcional, ya estan las tecnologias en la vista)
   - Al cambiar tecnologia: actualizar categorias (filtrar las categorias segun tecnologia seleccionada)
   - Al submit: llamar a `api.generateQuiz()` y redirigir a `/quiz?quizId=X`

Fragmento clave (las tecnologias renderizadas desde el backend):
```handlebars
<select name="technology" id="technology" required>
  <option value="">Selecciona tecnologia...</option>
  {{#each technologies}}
    <option value="{{this.id}}">{{this.name}}</option>
  {{/each}}
</select>
```

Pistas:
- Los selects deben tener un placeholder `Selecciona...` que no sea una opcion valida.
- El JS del cliente solo necesita para la cascada tecnologia -> categoria (el backend no sabe cual selecciona el usuario hasta el submit).
- Las tecnologias vienen del backend via `res.render('index', { technologies: [...] })` en el controlador.
- La redireccion es `window.location.href = '/quiz?quizId=' + result.quizId` (ahora ruta del backend, no HTML).
- Si el usuario no esta autenticado el generateQuiz va a fallar con 401. Muestra un mensaje amigable.

Que estudiar:
- Handlebars: `{{#each}}` para iterar
- HTML forms: select option input number form submit event
- Hibrido server-render + client-script: por que es necesario para la cascada
- fetch API con credentials: 'include' para mantener sesion

---

### Paso 5: Crear vista quiz.hbs (Quiz Runner)

Que hacer:
Crear `backend/src/views/pages/quiz.hbs`:
1. Header con titulo de pregunta y timer
2. Area de descripcion de la pregunta (placeholder se llena desde JS)
3. Contenedor para Monaco Editor (div vacio con id, se llena desde JS)
4. Botones: Saltar y Enviar Respuesta
5. Area de feedback (oculta inicialmente con clase `.hidden`)
6. Script JS del cliente (type module) que:
   - Lee quizId de URL params
   - Carga pregunta actual con `api.getCurrentQuestion()`
   - Al hacer click en Enviar: llama a `api.submitAnswer()` y muestra feedback
   - Al hacer click en Saltar: carga siguiente pregunta (skip)
   - Si `{ done: true }` redirige a `/results?quizId=X`

Fragmento clave (el contenedor del editor):
```handlebars
<div id="code-editor" class="editor-container"></div>
```

Pistas:
- El contenedor del editor debe tener un id especifico para que Monaco lo encuentre desde JS.
- El feedback debe tener un boton Siguiente para continuar no un setTimeout automatico.
- Saltar no guarda nada. Solo avanza a la siguiente pregunta.
- Si el quiz esta completo (`{ done: true }`) redirige inmediatamente a results.
- El JS del cliente importa los modulos `code-editor.js` `timer.js` `quiz-navigation.js` como ES modules.

Que estudiar:
- Hibrido server-render + client interactivity: el servidor provee estructura el cliente agrega comportamiento
- HTML data attributes: para pasar datos del backend al JS del cliente
- Element.classList: agregar/remover `.hidden` para mostrar feedback
- ES modules en navegador: import/export entre archivos del cliente

---

### Paso 6: Crear vista results.hbs (Resultados)

Que hacer:
Crear `backend/src/views/pages/results.hbs`:
1. Score total grande (centrado destacado) — placeholder que se llena desde JS
2. Lista de preguntas con placeholders (se llena desde JS):
   - Titulo de pregunta
   - Score individual (tests pasados / total)
   - Codigo enviado (colapsable)
   - Resultado del sandbox: tests pasados y fallados con detalle
3. Boton Nuevo Quiz que redirige a `/`
4. Script JS del cliente (type module) que:
   - Lee quizId de URL params
   - Fetch a `api.getResults(quizId)`
   - Renderiza todas las preguntas con sus resultados

Fragmento clave (el contenedor del score total):
```handlebars
<div id="total-score" class="score-large">--</div>
```

Pistas:
- Si no hay quizId en la URL muestra un mensaje de error y un link para volver.
- El score total debe tener formato grande (ej: font-size 3rem).
- Las preguntas pueden mostrarse como cards expandibles (accordion). El codigo va dentro de pre/code.
- Para cada pregunta muestra: tests pasados (verde) y tests fallados (rojo) con el expected vs stdout.
- Si el quiz no tiene submissions (todas las preguntas saltadas) muestra score 0 pero con la lista de preguntas.
- No hay feedback de IA - el usuario sabe que fallo mirando la diferencia entre expected y stdout.

Que estudiar:
- HTML details/summary: accordion nativo sin JS
- pre/code: mostrar codigo con formato monospace
- Renderizado dinamico: innerHTML vs createElement (seguridad XSS)
- Estado vacio: que mostrar si no hay datos
- Comparacion visual: resaltar diferencias entre expected y stdout

---

### Paso 7: Conectar frontend con backend (servir assets y rutas)

Que hacer:
En app.js del backend:
1. Servir archivos estaticos de `frontend/public/` con `express.static` usando ruta ABSOLUTA
2. Servir archivos de `frontend/src/` como estaticos (para modulos JS del cliente) usando ruta ABSOLUTA
3. Crear rutas GET que rendericen las vistas Handlebars:
   - GET / -> res.render('index', { technologies })
   - GET /quiz -> res.render('quiz')
   - GET /results -> res.render('results')

Fragmento clave (rutas absolutas para que funcione en dev y prod):
```javascript
app.use(express.static(join(__dirname, '../frontend/public')));
app.use('/src', express.static(join(__dirname, '../frontend/src')));
```

**NOTA IMPORTANTE:** Estas lineas requieren que `__dirname` este disponible. Esto se configura en Fase 1 Paso 4 via `fileURLToPath(import.meta.url)` + `dirname()`. Si __dirname es undefined las rutas no funcionan.

Pistas:
- Usa RUTAS ABSOLUTAS (`join(__dirname, '../frontend/public')`) NO rutas relativas (`'frontend/public'`). Las rutas relativas dependen del CWD y fallan cuando Render corre el server desde otra carpeta.
- En desarrollo (CWD = `backend/`) la ruta relativa funciona, pero en produccion (Render u otros) NO.
- Las rutas absolutas funcionan igual en ambos entornos porque se calculan desde la ubicacion del archivo `app.js`.
- El CSS esta en `frontend/public/styles/main.css` y se sirve como `/styles/main.css`.
- El JS del cliente esta en `frontend/src/components/` y se sirve como `/src/components/code-editor.js`.
- Las paginas HBS se renderizan con `res.render('nombre')`. Express busca en `views/pages/` (configurado en Fase 1).
- En Fase 15 (deploy) veras que esta misma configuracion se mantiene.

Que estudiar:
- express.static: servir multiples directorios
- res.render vs res.sendFile: cuando usar cada uno
- __dirname en ESM: por que se necesita y como se obtiene
- Rutas absolutas vs relativas: por que importa en deploy

---

## Checklist de verificacion

- [ ] index.hbs renderiza con tecnologias desde backend
- [ ] Cascada tecnologia -> categorias funciona (JS del cliente)
- [ ] Generate quiz redirige a /quiz?quizId=X
- [ ] quiz.hbs renderiza con contenedores para Monaco y timer
- [ ] results.hbs renderiza y el JS del cliente muestra scores
- [ ] CSS responsive funciona en mobile
- [ ] Navegacion entre paginas funciona
- [ ] Sin errores en consola del navegador

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| CSS custom properties | Tema mantenible y consistente |
| Fetch API con credentials | Comunicacion con cookies de sesion |
| HTML forms + cascada | UX de seleccion dependiente |
| Paginas HTML modulares | index quiz results separadas |
| Static serving desde Express | Backend sirve frontend |