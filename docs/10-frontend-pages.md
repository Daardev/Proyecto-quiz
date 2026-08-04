# Fase 10: Frontend - Paginas y Estilos

## Objetivo
Crear la interfaz de usuario con paginas renderizadas con Handlebars desde el backend, CSS con tema dark glassmorphism y el cliente API para componentes interactivos del lado cliente. Al finalizar las paginas (selector quiz resultados) deben verse bien y navegar entre si. **Modelo simplificado**: el selector de `/` ahora pide solo `language`, no categoría.

IMPORTANTE: El spec usa Handlebars para TODAS las paginas (no HTML vanilla). Las vistas se crean en `backend/src/views/pages/` como archivos `.hbs` y se renderizan con `res.render()`. Los componentes JS de frontend solo se usan dentro de paginas HBS que necesitan interactividad en el cliente (ej: Monaco Editor en quiz.hbs).

---

### Paso 1: Crear estructura del frontend

Estructura del proyecto:
- `backend/src/views/pages/` - vistas Handlebars (index.hbs quiz.hbs results.hbs profile.hbs dashboard.hbs)
- `backend/src/views/layouts/` - layouts (main.hbs)
- `backend/src/views/partials/` - partials (navbar.hbs)
- `frontend/public/styles/main.css` - CSS vanilla global (servido estaticamente)
- `frontend/src/components/` - modulos JS opcionales para interactividad (Monaco Timer etc)
- `frontend/src/lib/api-client.js` - Fetch helper

---

### Paso 2: Crear `main.css`

Archivo `public/styles/main.css` con:
1. Reset CSS basico
2. Tema dark glassmorphism: variables CSS, `backdrop-filter: blur(20px)`, bordes sutiles
3. `.container` con max-width 900px
4. **Cards glass**: gradiente sutil, blur, sombra multicapa, hover lift
5. **`.option-row`**: glass rows para opciones de MC con hover/focus
6. **`.feedback-card`** con estados `passed`/`failed` (ya no se usa `skipped` desde que el skip se modela como una submission fallida marcada con `kind='skipped'`)
7. **Estilos de quiz**: timer, editor Monaco, progress bar
8. Formularios con focus rings
9. Botones con hover
10. Media queries para mobile

Variables clave:
```css
--glass-bg, --glass-border, --glass-shadow, --glass-shadow-hover, --ease-out
```

---

### Paso 3: Crear `api-client.js`

Clase `ApiClient` con baseURL `/api` y métodos:
- `getMe()`, `logout()`, `register(data)`, `login(data)`
- `getLanguages()` → lista de lenguajes disponibles
- `generateQuiz(data)` → con `{ language, count }`
- `getCurrentQuestion(quizId)`, `submitAnswer(quizId, data)`, `getResults(quizId)`

---

### Paso 4: Crear vista `index.hbs` (Selector de quiz)

```html
<form id="quiz-form">
  <select id="language" required>
    {{#each languages}}
      <option value="{{this}}">{{this}}</option>
    {{/each}}
  </select>
  <input type="number" id="count" min="1" max="20" value="5" required>
  <button>Iniciar Quiz</button>
</form>
```

JS: al cargar, GET `/api/languages` y llenar el select. Al submit, POST `/api/quizzes/generate` con `{ language, count }` y redirigir a `/quiz?quizId=X`.

---

### Paso 5: Crear vista `quiz.hbs` (Quiz runner)

- Header con título de pregunta y corazones (5 ♥)
- Tag con el lenguaje actual
- **Si es code**: area de Monaco Editor (cargado via CDN)
- **Si es MC**: container con opciones (botones A/B/C/D/E) — radio button equivalente, con estados visuales:
  - `.option-btn` (base)
  - `.option-btn.is-selected` (selección actual, borde accent)
  - `.option-btn.is-incorrect` (opción ya marcada como incorrecta, borde rojo — **se acumula**: cada opción fallida mantiene el rojo hasta que la pregunta avance)
- Botón **Enviar respuesta** (siempre visible; el `.answer-zone` se reemplaza por la animación tras submit)
- **Sin** botón Saltar en el flujo actual
- **Sin** tarjetas de feedback intermedio: las animaciones `✓` / `✗` reemplazan el botón durante ~550-850ms
- **Inline JSON de la primera pregunta** (inyectado por SSR — ver Paso 7 y Fase 8):
  ```hbs
  <script type="module">
    import { api } from '/src/lib/api-client.js';
    import { CodeEditor } from '/src/components/code-editor.js';
    const params = new URLSearchParams(window.location.search);
    const quizId = parseInt(params.get('quizId'), 10);
    const firstQuestion = {{{json firstQuestion}}};   // ← el server ya lo calcula
    ...
  </script>
  ```
  Esto evita el primer `fetch` cuando el usuario llega al quiz. En preguntas 2+ el cliente sigue llamando a `api.getCurrentQuestion` (la pregunta anterior ya cambió el estado en BD).

Pistas:
- `{{{json firstQuestion}}}` usa el helper `json` registrado en `app.js` (`Handlebars.SafeString(JSON.stringify(...))`) para que Handlebars no escape caracteres. Si `firstQuestion` es `null`, este helper imprime literalmente `null` (sin comillas) — perfecto, el JS lo lee como `null`.
- En el JS, `loadQuestion()` debe chequear `if (firstQuestion) { render(firstQuestion); return; }` **antes** de hacer el `fetch`. Asi se ahorra el round-trip en la primera pregunta.
- Si por algun motivo `firstQuestion.__error` esta presente, el cliente debe hacer fallback al `fetch` (degradacion elegante).

Flujo JS: importar `ApiClient` y `CodeEditor`, leer `quizId` de URL, cargar pregunta actual con `getCurrentQuestion`. Al hacer submit:
- Incorrecto → animación `✗` (rojo, shake) durante ~550ms, luego el botón submit reaparece habilitado. En preguntas MC, la opción seleccionada recibe `.is-incorrect` (borde rojo) que se mantiene aunque el usuario cambie a otra opción. El usuario puede re-tipear y reenviar. Si vidas = 0 → redirect a `/results`.
- Correcto → animación `✓` (verde, pop) durante ~850ms, luego auto-avance a la siguiente pregunta. Las marcas rojas se limpian al cargar una nueva pregunta. Si vidas = 0 → redirect a `/results`.
- **Ningún score ni detalles de tests se muestran durante el quiz**: todo eso se expone únicamente en `/results` al finalizar.

---

### Paso 6: Crear vista `results.hbs` (Resultados)

- Score total grande (animación de conteo)
- Lista de preguntas con resultados:
  - Título numerado (`1. ...`, `2. ...`)
  - Descripción (muted)
  - Bloque **Tu respuesta**: MC muestra texto de la opción elegida / code muestra `<pre>` con scroll. Fondo verde si correcto, rojo si incorrecto, gris si no respondida.
  - Bloque **Respuesta correcta**: MC muestra texto de la opción correcta / code es un `<details>` expandible con `q.solution`.
  - Card color: verde para `passed` (border-left 4px + tinte verde), rojo pronunciado para `failed` (border-left 6px + tinte rojo + halo), gris para `skipped`.
  - "Score: X · Tests: Y/Z"
- Boton Nuevo Quiz que lleva a `/`

JS: al cargar, fetch a `getResults(quizId)`, renderizar todas las preguntas con su resultado, animar el score total. El backend pre-computa `status`, `isCorrect`, `userAnswerText`, `correctAnswer`, etc.

---

### Paso 7: Conectar frontend con backend

En `app.js`:
1. Servir archivos estaticos de `frontend/public/` con `express.static` (ruta ABSOLUTA)
2. Servir archivos de `frontend/src/` como estaticos (ruta ABSOLUTA)
3. Crear rutas GET que rendericen vistas Handlebars:
   - `GET /` → `res.render('index', { languages })`
   - `GET /quiz` → **asincrona**: ejecuta `getCurrentQuestionData(quizId)` (reutilizando la funcion pura de la Fase 8) y pasa el resultado como `firstQuestion` a Handlebars. Si no hay `quizId`, pasa `null`.
   - `GET /results` → `res.render('results')`

Codigo completo de `GET /quiz` con SSR:

```js
app.get('/quiz', async (req, res, next) => {
  try {
    const quizId = parseInt(req.query.quizId, 10);
    let firstQuestion = null;
    if (Number.isInteger(quizId)) {
      const data = await getCurrentQuestionData(quizId);
      if (!data.__error) firstQuestion = data;
    }
    res.render('pages/quiz', { firstQuestion });
  } catch (err) {
    next(err);
  }
});
```

#### Por que importa

Antes, `GET /quiz` solo renderizaba el shell HTML y el cliente tenia que hacer un `fetch` extra a `GET /api/quizzes/:id/current` solo para mostrar la primera pregunta. En Neon eso eran ~500-1500ms de espera.

**Con SSR**: el mismo JOIN que sirve al endpoint se ejecuta una sola vez en el server, el resultado viaja inline en el `<script>` de la vista, y el cliente pinta la pregunta sin hacer ningun fetch. Resultado: la primera pregunta aparece junto con el HTML de la pagina.

**Regla**: si una vista necesita datos en su primera renderizacion, **inyectalos en el server**. No hagas al cliente pagar un round-trip extra solo para arrancar.

#### Pistas clave

- **Reutiliza `getCurrentQuestionData(quizId)`**: misma funcion pura que el endpoint HTTP. No copies la query ni la logica de "siguiente pendiente". Asi si el algoritmo cambia, SSR y endpoint se mueven juntos.
- **Fallback elegante**: si la query falla (quiza Neon este caido), pasas `firstQuestion = null` y `renderQuestion` cae al `fetch`. El usuario nunca ve una pagina rota.
- **`parseInt(req.query.quizId, 10)`**: si no es entero, `firstQuestion` queda `null` y el cliente hara `fetch`. Nunca envies un `quizId` invalido a la base de datos.
- **`if (!data.__error) firstQuestion = data`**: ignora payloads de error del controller puro. Si la pregunta no existe, el cliente hara `fetch` y el endpoint devolvera 404.

Usa rutas ABSOLUTAS con `path.join(__dirname, '../../frontend/public')` para que funcione en dev y prod.

---

### Checklist de verificacion

- [ ] `index.hbs` renderiza con dropdown de lenguajes
- [ ] Cascada language → quiz funciona
- [ ] `generateQuiz` redirige a `/quiz?quizId=X`
- [ ] `quiz.hbs` renderiza con containers para Monaco o MC según `type`
- [ ] `results.hbs` renderiza y el JS muestra scores
- [ ] CSS responsive funciona en mobile
- [ ] `GET /quiz?quizId=X` inserta la primera pregunta como JSON inline en el HTML (`view-source` lo muestra)
- [ ] La primera pregunta aparece sin que el cliente haga ningun `fetch` a `/api/.../current` (verificable en la pestana Network del navegador)

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Glassmorphism | UI moderna con backdrop-filter y blur |
| Fetch API con credentials | Comunicacion con cookies de sesion |
| Selector de lenguaje | UX simple: solo 2 opciones |
| ES modules en navegador | Importar api-client directamente |
| Static serving desde Express | Backend sirve frontend en un solo puerto |
