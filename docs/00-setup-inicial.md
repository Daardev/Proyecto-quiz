# Fase 0: Setup Inicial del Proyecto

## Objetivo
Crear la raiz del proyecto antes de programar: repo git estructura de carpetas top-level README y .gitignore raiz. Esta fase es pre-desarrollo y la hace una sola vez al inicio del proyecto.

---

### Paso 1: Crear repo Git

Que hacer:
1. Crear una carpeta llamada `quiz-ia` en tu maquina (donde vivira todo el proyecto)
2. Entrar a la carpeta y ejecutar `git init`
3. Crear un repo vacio en GitHub o GitLab
4. Conectar el repo local con el remoto: `git remote add origin <url-del-repo>`
5. Verificar la rama principal se llama `main` (no `master`)

Pistas:
- Si tu Git usa `master` por defecto renombrala: `git branch -M main`
- En GitHub/GitLab configura la rama `main` como protegida (proteger de push directos).
- El repo remoto debe estar VACIO al inicio (sin README ni .gitignore pre-creados). Asi evitamos conflictos con los archivos locales.

Que estudiar:
- Git basics: init add commit push pull
- Ramas protegidas en GitHub/GitLab
- Diferencia entre repo local y remoto

---

### Paso 2: Crear estructura de carpetas raiz

Que hacer:
Crear manualmente esta estructura en la raiz del proyecto:

```
quiz-ia/
  backend/                ← todo el codigo backend (Fases 1-11)
  frontend/               ← assets del frontend (Fases 8-9)
  docs/                   ← spec.md + todas las fases
```

Comando rapido (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path @(
  "backend",
  "frontend",
  "docs"
) | Out-Null
```

Pistas:
- Las tres carpetas iran vacias al inicio. Las Fases 1-11 iran poblando `backend/` y `frontend/`. La spec.md y todas las fases iran en `docs/`.
- NO crees archivos sueltos en la raiz (excepto README y .gitignore).
- Las fases existentes asumen esta estructura. Si te salteas este paso las fases daran errores de rutas.

Que estudiar:
- Convenciones de organizacion de proyectos fullstack
- Separacion frontend/backend: por que es importante

---

### Paso 3: Crear .gitignore raiz

Que hacer:
Crear archivo `.gitignore` en la raiz de `quiz-ia/` con este contenido:

```
node_modules/
.env
.env.local
*.log
npm-debug.log*
.DS_Store
.vscode/
.idea/
```

Pistas:
- Este `.gitignore` aplica a TODO el proyecto (backend y frontend).
- Los `.gitignore` especificos de `backend/` y `frontend/` se crean en la Fase 1 (backend) y se podrian crear en frontend si fuera necesario.
- `node_modules/` es la exclusion MAS IMPORTANTE. Sin esto subes miles de archivos innecesarios.
- `.env` contiene passwords y API keys. NUNCA debe subirse.

Que estudiar:
- Que es .gitignore y como funciona (patrones glob)
- Que archivos DEBEN ignorarse en un proyecto Node.js

---

### Paso 4: Crear README.md inicial

Que hacer:
Crear archivo `README.md` en la raiz de `quiz-ia/`:

```markdown
# Quiz-IA

Plataforma de quizzes de programacion con ejecucion de codigo en sandbox y evaluacion basada en tests predefinidos.

## Stack

- Backend: Node.js + Express + PostgreSQL (Drizzle ORM + Neon)
- Frontend: Handlebars + JavaScript ES6+ + CSS vanilla
- Auth: Google OAuth
- Sandbox: Judge0

## Estructura

- `backend/` — codigo del backend
- `frontend/` — assets del frontend
- `docs/` — spec del proyecto y fases de desarrollo

## Comandos basicos

\`\`\`
cd backend
npm install
npm run dev
\`\`\`

Ver `docs/` para la spec completa y las fases de desarrollo.
```

Pistas:
- El README es la primera impresion del proyecto. Debe responder: que es como se instala y donde esta la documentacion.
- NO pongas codigo aqui todavia. Solo descripcion general.
- A medida que el proyecto crece actualiza el README con instrucciones completas.

Que estudiar:
- Que debe contener un buen README
- Markdown basico: titulos listas links bloques de codigo

---

### Paso 5: Primer commit

Que hacer:
1. `git add .` para stagear todos los archivos
2. `git commit -m "chore: setup inicial del proyecto"`
3. `git push -u origin main`

Pistas:
- Conventional Commits es una buena practica: `chore:` para setup `feat:` para features `fix:` para bugs.
- El primer push con `-u origin main` establece el upstream. Despues solo `git push`.
- Verifica en GitHub/GitLab que los archivos se subieron (excepto `node_modules/` y `.env` que estan en `.gitignore`).

Que estudiar:
- Conventional Commits: convencion para mensajes de commit
- `git add` `git commit` `git push`: flujo basico
- Como verificar que un archivo NO se subio (buscarlo en el repo remoto)

---

## Checklist de verificacion

- [ ] Repo Git creado en GitHub/GitLab
- [ ] Repo local conectado al remoto
- [ ] Estructura de carpetas `backend/` `frontend/` `docs/` creada
- [ ] `.gitignore` raiz con contenido basico
- [ ] `README.md` inicial creado
- [ ] Primer commit subido a `main`
- [ ] En el repo remoto NO aparecen `node_modules/` ni `.env`

---

## Errores comunes resumen

| Error | Causa probable |
|-------|----------------|
| Permiso denegado al push | Repo remoto no existe o URL mal escrita |
| Conflict en el primer push | El repo remoto tiene archivos (README .gitignore etc) que el local no |
| `node_modules` aparece en git status | `.gitignore` no esta en la raiz o el patron es incorrecto |
| Rama `master` en vez de `main` | No renombraste con `git branch -M main` |

---

## Resumen de conceptos nuevos

| Concepto | Por que es importante |
|----------|----------------------|
| Repo local vs remoto | GitHub/GitLab como backup y para colaborar |
| .gitignore raiz | Aplica a todo el proyecto no solo a una subcarpeta |
| Conventional Commits | Mensajes estandarizados faciles de leer |
| Estructura monorepo (sin paquetes) | Mas simple que Lerna/Nx para este tamaño de proyecto |