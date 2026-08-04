# Fase 12: Panel de Usuario

## Objetivo
Crear una pagina `/profile` donde el usuario autenticado vea sus datos personales, estadisticas globales e historial de quizzes completados. Solo se muestran datos individuales (sin ranking, sin codigo de submissions, sin fotos de perfil). **Modelo simplificado**: el historial muestra el `language` del quiz en vez de categoría.

---

### Paso 1: Crear rutas del perfil

Que hacer:
Crear `src/routes/profile.routes.js` con:
1. `GET /` (dentro del router montado en `/profile`) → `getProfile`
2. `GET /api/quizzes` (dentro del router montado en `/api/users/me`) → `getMyQuizzesApi`
3. `GET /api/stats` (dentro del router montado en `/api/users/me`) → `getMyStatsApi`

Montar en `app.js`:
- `app.use('/profile', isAuthenticated, profileRoutes)`
- `app.use('/api/users/me', isAuthenticated, userMeRoutes)`

---

### Paso 2: Crear controlador del perfil

Que hacer:
Crear `src/controllers/profile.controller.js` con tres funciones:

1. `getUserQuizzes(userId)`:
   - Hace query a `quizzes` filtrando por `userId`
   - Para cada quiz, calcula el score total sumando submissions
   - Retorna array con `{ id, language, startedAt, completedAt, score }`

2. `getUserStats(userId)`:
   - Cuenta quizzes completados (`completed_at IS NOT NULL`)
   - Cuenta quizzes abandonados
   - Score total (SUM)
   - Mejor score (MAX)
   - Retorna `{ totalCompleted, totalAbandoned, totalScore, bestScore }`

Pistas:
- El `language` del quiz se muestra tal cual en el historial (no se mapea a categoría).
- Si las funciones son async/await, asegurate de envolver en try/catch.
- Para quizzes anonimos: `quizzes.userId` puede ser null. La query SIEMPRE filtra por `WHERE user_id = $1`.

---

### Paso 3: Crear vista profile.hbs

Fragmento clave (la condicion del estado vacio es la parte mas importante):

```handlebars
{{#if quizzes.length}}
  <table>
    <thead>
      <tr>
        <th>Lenguaje</th>
        <th>Inicio</th>
        <th>Estado</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>
      {{#each quizzes}}
        <tr>
          <td>{{this.language}}</td>
          <td>{{formatDate this.startedAt}}</td>
          <td>{{#if this.completedAt}}Completado{{else}}Abandonado{{/if}}</td>
          <td>{{this.score}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
{{else}}
  <p>Aun no has completado ningun quiz. <a href="/">Inicia tu primer quiz</a></p>
{{/if}}
```

---

### Paso 4: Cards de stats

```handlebars
<div class="row">
  <div class="card"><h3>{{stats.totalCompleted}}</h3><span>Completados</span></div>
  <div class="card"><h3>{{stats.totalAbandoned}}</h3><span>Abandonados</span></div>
  <div class="card"><h3>{{stats.totalScore}}</h3><span>Score total</span></div>
  <div class="card"><h3>{{stats.bestScore}}</h3><span>Mejor score</span></div>
</div>
```

---

### Paso 5: Helpers de Handlebars

En `app.js` registrar helper `formatDate`:

```js
hbs.handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
});
```

---

### Paso 6: Probar flujo completo

1. Iniciar servidor con `npm run dev`
2. Login con Google... no, login con `admin` / `admin12345` (admin user creado via env vars)
3. Visitar `/profile`
4. Verificar stats correctas
5. Crear quiz desde `/`, completarlo
6. Volver a `/profile`
7. Verificar que aparece en historial con score y "Completado"
8. Logout

---

### Checklist de verificacion

- [ ] `GET /profile` renderiza la vista con datos del usuario
- [ ] Seccion de stats calcula correctamente (4 cards)
- [ ] Historial muestra quizzes ordenados por fecha DESC
- [ ] Columna Lenguaje aparece en cada fila del historial
- [ ] Estado vacio aparece si no hay quizzes
- [ ] Quiz abandonado se distingue del completado
- [ ] Helper `formatDate` funciona en las fechas
- [ ] Score se muestra como numero (0-100 por pregunta, hasta score total)

---

### Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| res.locals | Variables disponibles automaticamente en todas las vistas |
| try/catch en controladores async | Manejo seguro de errores |
| Reutilizacion de funciones | Entre render y JSON |
| Cohesion de vistas | partials (navbar) que se incluyen en multiples paginas |
| Aislamiento por user | SIEMPRE filtrar por user_id en queries autenticadas |
| Score fijo | Max 100 por pregunta, sin multiplicador de dificultad |
