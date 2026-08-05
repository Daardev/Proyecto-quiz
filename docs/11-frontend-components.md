# Fase 11: Frontend - Componentes Interactivos

## Objetivo
Agregar interactividad real: Monaco Editor para escribir codigo, timer con cuenta regresiva, manejo de respuestas MC y code. Esta fase completa el proyecto. **Modelo simplificado**: el campo `category` de la pregunta ya no existe, ahora se usa `language`.

---

### Paso 1: Implementar CodeEditor component

Que hacer:
Crear `src/components/code-editor.js` con:
1. Clase `CodeEditor` que recibe `containerId` y opciones (`language`, `theme`, `value`)
2. Metodo `init()` que carga Monaco desde CDN y crea el editor
3. Configuracion: `automaticLayout`, `minimap: false`, `fontSize: 14`
4. Metodos `getValue()`, `setValue(code)`, `destroy()`

Pistas:
- Monaco desde CDN: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js`
- automaticLayout para que se redimensione solo
- Para preguntas de SQL, el editor sigue siendo JS (no hay Monaco SQL syntax). Los tests se ejecutan con PGlite.

---

### Paso 2: Sistema de Corazones (intentos)

**Contexto**: el modelo original usaba un timer de 5 minutos + 10s por pregunta respondida. Se cambió a un sistema de **5 intentos totales** representados como **corazones** (`♥`) en la UI. El flujo es:

- Respuesta **incorrecta** → consume 1 corazón + animación breve de error (✗ rojo con shake, ~550ms) + rehabilitación del botón submit para reintentar.
- Respuesta **correcta** → no consume corazón + animación de check (✓ verde, ~850ms) + **auto-avance** a la siguiente pregunta.
- El usuario puede **reenviar** una respuesta en la misma pregunta; cada envío incorrecto consume otro corazón.
- `attemptsLeft <= 0` → redirige a `/results` automáticamente.
- **Sin botón Saltar**: el usuario solo puede corregir su respuesta hasta acertar (o quedarse sin vidas).
- **Sin feedback intermedio**: ni score ni "Continuar" ni tarjetas con detalles durante el quiz. Toda la info detallada se ve solo en `/results` al finalizar.

Que hacer (en `quiz.hbs`, inline en el `<script type="module">`):
1. HTML: contenedor `<div class="hearts" id="hearts">` con 5 `<span class="heart">♥</span>` (índices 0-4) + `.answer-zone` con el `#submit-btn`.
2. Estado: `const MAX_ATTEMPTS = 5; let attemptsLeft = MAX_ATTEMPTS;`.
3. `consumeHeart()`: aplica la clase `.lost` al siguiente corazón disponible.
4. `applyAttempts(left, max)`: actualiza los corazones según `attemptsLeft`.
5. `refreshSubmitState()`: rehabilita/deshabilita el `#submit-btn` según `attemptsLeft`.
6. `showCheckAnimation()`: reemplaza el contenido del `.answer-zone` con un `<div class="answer-feedback is-correct">✓</div>` (animación CSS `checkPop`).
7. `showErrorAnimation()`: igual pero con `<div class="answer-feedback is-error">✗</div>` (animación CSS `errorShake`).
8. `restoreSubmitButton()`: después de la animación de error, restaura el botón submit en `.answer-zone` y le vuelve aattachar el handler.
9. Submit handler:
   - Si **incorrecto** → `consumeHeart()`, `applyAttempts`, `hideAnalyzing`, **`markSelectedOptionIncorrect()`** (en MC: aplica `.is-incorrect` al botón del `selectedOption` y le quita `.is-selected`; se acumula con futuras selecciones incorrectas), `showErrorAnimation()`. Si `attemptsLeft <= 0` → `setTimeout` redirect a `/results`; si no, `setTimeout` que llama `restoreSubmitButton` + `enableInputs` + `submitting = false`.
   - Si **correcto** → `applyAttempts`, `hideAnalyzing`, `showCheckAnimation()`. Si `attemptsLeft <= 0` → `setTimeout` redirect a `/results`; si no, `setTimeout` que llama `loadQuestion()` para auto-avanzar (las marcas rojas se limpian al recrear las opciones).
10. En ambos handlers, agregar guard `attemptsLeft <= 0` para bloquear acciones cuando no quedan intentos.

CSS (`main.css`):
- `.hearts`: contenedor inline-flex con gap, borde y fondo consistente con el resto de la UI.
- `.heart`: corazón rojo (color `--danger`) con glow (`text-shadow`).
- `.heart.lost`: corazón gris, opacidad 0.35, animación `heartBreak` (scale 1 → 1.5 → 1 con flash rojo, 0.5s).
- `@keyframes heartBreak`: pico de escala con `drop-shadow` en `var(--danger)`.
- `.answer-zone`: contenedor flex del botón submit / animación.
- `.answer-feedback`: contenedor grande centrado con el ícono ✓ o ✗.
- `.answer-feedback.is-correct`: color `--success` con animación `checkPop` (scale 0 → 1.25 → 1 con glow verde).
- `.answer-feedback.is-error`: color `--danger` con animación `errorShake` (shake horizontal + flash rojo).
- `.option-btn`: botón base de opción MC.
- `.option-btn.is-selected`: opción actualmente elegida, borde `--accent` + glow cyan + fondo translúcido.
- `.option-btn.is-incorrect`: opción que ya fue marcada como incorrecta, borde `--danger` + glow rojo + fondo rojizo. **Se acumula**: si el usuario falla varias opciones distintas, todas mantienen el rojo.

CSS (`main.css`):
- `.hearts`: contenedor inline-flex con gap, borde y fondo consistente con el resto de la UI.
- `.heart`: corazón rojo (color `--danger`) con glow (`text-shadow`).
- `.heart.lost`: corazón gris, opacidad 0.35, animación `heartBreak` (scale 1 → 1.5 → 1 con flash rojo, 0.5s).
- `@keyframes heartBreak`: pico de escala con `drop-shadow` en `var(--danger)`.

Que estudiar:
- Cambio de modelo: de timer (estado continuo) a contador (estado discreto). Menos código, más claro.
- Animación CSS como feedback visual del consumo.
- Botón de feedback dinámico según estado para guiar al usuario a `/results`.

---

### Paso 3: Implementar QuizNavigation component

Clase para miniaturas de preguntas. Nota: en el modelo simplificado, ya no se navega entre categorías, pero la navegación entre preguntas del mismo quiz sigue siendo útil.

---

### Paso 4: Integrar todo en `quiz.hbs`

Reemplazar el script inline de `quiz.html` con:
1. Importar `CodeEditor`, `ApiClient`
2. Al cargar la pagina:
   - Leer `quizId` de URL
   - **Leer `firstQuestion` desde la variable inline (ver Fase 10 Paso 5 y Paso 7)** — el server ya lo calculo via SSR
   - Inicializar `CodeEditor` (aun sin valor)
   - Cargar primera pregunta
3. Funcion `renderQuestion(data)` (pura: dado un payload, dibuja):
   - Mostrar `title`, `description`, `order/total`, `language`
   - Pintar corazones segun `attemptsLeft`
   - Si `attemptsLeft === 0` redirigir a `/results`
   - Si `type === 'code'`: inicializar Monaco con `starterCode`
   - Si `type === 'multiple_choice'`: renderizar opciones A/B/C/D/E como botones
   - Setear `selectedOption` al click en una opcion
4. Funcion `loadQuestion()`:
   - **Si `firstQuestion` esta presente y es valido (`!firstQuestion.__error`)**:
     - Llamar a `renderQuestion(firstQuestion)` directamente (sin fetch)
     - Limpiar `window.firstQuestion = null` para que preguntas 2+ usen fetch
     - Si `data.done === true` redirigir a `/results`
     - return
   - **Si no** (fallback): fetch a `getCurrentQuestion` y luego `renderQuestion(data)`
5. Funcion `submitAnswer()`:
   - Si MC: enviar `{ questionId, answer: selectedOption }`
   - Si code: enviar `{ questionId, code: editor.getValue() }`
   - Mostrar feedback con score
6. Funcion `renderFeedback(result)`:
   - Score (max 100, sin multiplicador)
   - Lista de tests con ✓/✗

Esqueleto recomendado:

```js
async function renderQuestion(data) { /* dibuja */ }

async function loadQuestion() {
  submitting = false;
  restoreSubmitButton();

  if (firstQuestion && !firstQuestion.__error) {
    const data = firstQuestion;
    window.firstQuestion = null;            // preguntas 2+ iran a fetch
    if (data.done) { window.location.href = `/results?quizId=${quizId}`; return; }
    try { await renderQuestion(data); }
    catch (err) { titleEl.textContent = err.message; }
    return;
  }

  try {
    const data = await api.getCurrentQuestion(quizId);
    if (data.done) { window.location.href = `/results?quizId=${quizId}`; return; }
    await renderQuestion(data);
  } catch (err) {
    titleEl.textContent = err.message;
  }
}
```

Pistas:
- `currentQuestion.language` se usa solo internamente para el sandbox, no se muestra al usuario
- `currentQuestion.type` decide si mostrar Monaco o radio buttons
- Si `data.done === true` redirigir a `/results`
- **El atajo de `firstQuestion` es CRITICO para la percepcion de velocidad**: ahorra 1 round-trip (cliente → servidor) en la primera pregunta. Sin esto, el usuario espera ~500-1500ms viendo solo "Cargando..." hasta que el JS hace su primer fetch. Con esto, ve la pregunta junto con el HTML.
- **Por que preguntas 2+ SI hacen fetch**: la pregunta anterior ya cambió el estado en BD (submissions, attemptsLeft), asi que el server es la fuente de verdad. No intentes cachear preguntas en el cliente.

---

### Paso 5: Implementar `results.html` con datos reales

JS:
1. Importar `ApiClient`
2. Al cargar: fetch a `getResults(quizId)`
3. Mostrar:
   - Score total (animado)
   - Lista de preguntas con score individual (max 100)
   - Por cada pregunta, dos bloques visuales:
     - **Tu respuesta** (`.answer-block`): para MC muestra el texto de la opción elegida; para code muestra el código enviado en `<pre>` con scroll. Fondo verde si correcto, rojo si incorrecto, gris si no respondida.
     - **Respuesta correcta** (`.answer-block.is-correct`): para MC muestra el texto de la opción correcta; para code es un `<details>` expandible con `q.solution` (o "Sin solución disponible" si null).
   - **Card color**: `.feedback-card.passed` → verde (border 4px + tinte), `.feedback-card.failed` → rojo pronunciado (border 6px + tinte rojo + halo).
4. Al final: botón "Nuevo quiz" que enlaza a `/`.

Notas de implementación:
- El backend `getQuizResults` incluye `status` (`'passed'` | `'failed'` | `'skipped'`), `isCorrect`, `userAnswerIndex`, `userAnswerText`, `correctAnswer`, `options`, etc. para que el frontend renderice sin recalcular nada.
- La lógica de `isCorrect` se persiste en `sandboxResults._isCorrect` (boolean) durante `submitAnswer` para evitar el bug `0 === 0` en MC.

---

### Paso 6: Probar flujo completo end-to-end

1. Abrir `/`
2. Seleccionar lenguaje
3. Hacer click en Iniciar Quiz
4. Verificar redireccion a `/quiz?quizId=...`
5. Verificar que Monaco Editor carga (si es code) o los botones MC (si es MC)
6. Verificar que el timer inicia
7. Escribir codigo o seleccionar opcion
8. Enviar respuesta
9. Verificar feedback (score 0-100)
10. Repetir hasta terminar
11. Verificar redireccion a `/results`
12. Verificar scores y feedback por pregunta

Pistas:
- Si Monaco no carga revisa la consola del navegador. Posible error de CORS en el CDN.
- Si el feedback no llega probablemente el sandbox no esta configurado. Revisa los logs del backend.
- Si los scores son siempre 0 el sandbox esta fallando. Verifica los logs.

---

### Paso 7: Manejo de errores

Bloque try/catch alrededor de todas las llamadas a API. Mensajes amigables para:
- Backend no disponible
- No autenticado (para guardar)
- Error de red
- Sandbox no disponible

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Monaco Editor | Editor de codigo profesional en el browser |
| Componentes JS | Encapsulacion de UI en clases reutilizables |
| Timer/interval | Gestion de tiempo en el navegador |
| Maquina de estados del quiz | Flujo ordenado: carga → responde → feedback → siguiente |
| Type detection (code vs MC) | UI dinamica segun `type` de la pregunta |

---

## Layout de preguntas de código (dos paneles)

A partir de esta fase, las preguntas de código (`type === 'code'`) usan un layout de **dos paneles lado a lado** en lugar de un único editor con el `starterCode` precargado.

### Estructura visual

```
┌─────────────────────────────┬─────────────────────────────┐
│ Enunciado y código inicial  │ Tu código                   │
│ (read-only)                 │ (editable)                  │
│                             │                             │
│ #65                         │ // Escribe tu código aquí   │
│ "Escribe una consulta SQL…" │                             │
│                             │ SELECT …                    │
│ -- sólo visible para el user │                             │
│ CREATE TABLE productos(...) │                             │
│                             │ [Probar código] [Enviar]    │
│                             │ // (consola de preview)     │
└─────────────────────────────┴─────────────────────────────┘
```

### Por qué dos paneles

- **Izquierda**: el usuario VE el `starterCode` (comentarios del schema, statements de configuración, hints) sin poder modificarlo. Es una guía visual de qué tiene disponible (tablas, helpers, etc.).
- **Derecha**: el usuario ESCRIBE su respuesta desde cero. El editor está vacío con placeholder `// Escribe tu código aquí`.

### `setupCode` vs `starterCode`

Se separan dos campos que antes vivían mezclados en `starterCode`:

- `setupCode`: se ejecuta en el sandbox **antes** del código del usuario. NO se muestra en la UI. Útil para SQL (`CREATE TABLE` / `INSERT INTO`) o JS (helpers como `getWords()`).
- `starterCode`: lo que se ve en el panel read-only. NO se ejecuta. Sirve como referencia/hint.

### Botones de la zona de respuestas

- **Probar código** (secundario, solo visible en code): ejecuta el código en el sandbox y muestra la salida cruda en una **consola** debajo del editor. No afecta `attemptsLeft`. Endpoint: `POST /api/quizzes/:quizId/preview`.
- **Enviar respuesta** (danger): corre los tests reales, marca ✓/✗, consume corazón si falla. Endpoint: `POST /api/quizzes/:quizId/submit`.

### Salida de la consola

- `kind === 'sql'`: renderiza tabla con headers (columnas inferidas de `Object.keys(rows[0])`) y filas. Si 0 filas → `// (consulta sin resultados)`.
- `kind === 'js'`: JSON pretty-printed del valor retornado por la función principal.
- `kind === 'markup'`: solo validación de regex.
- `ok === false`: texto en rojo con el error.

### Soporte multi-lenguaje

El layout aplica por **`type === 'code'`**, no por lenguaje. Soporta:
- `sql` (PGlite)
- `js-avanzado`, `javascript`, `node` (QuickJS)
- `html-css-js` (regex markup)

Una pregunta Node nueva hereda toda la estructura automáticamente.
| Error handling en frontend | UX profesional no alert() |
