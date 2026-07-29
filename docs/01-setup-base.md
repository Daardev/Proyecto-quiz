# Fase 1: Setup Base del Backend

## Objetivo
Inicializar el proyecto Node.js con Express, estructura de carpetas profesional y configuracion basica funcional. Al finalizar esta fase, deberias poder ejecutar npm run dev y ver el servidor corriendo.

---

### Paso 1: Crear carpeta backend e inicializar npm

Que hacer:
- Crear carpeta backend/ en la raiz del proyecto
- Ejecutar npm init -y dentro
- Abrir package.json y agregar type module

Pistas:
- type module le dice a Node que uses import/export en vez de require. Sin esto tendrias que usar require y todo el proyecto seria CommonJS.
- Si ves el error require is not defined in ES module scope es porque falta type module o estas mezclando estilos.
- Alternativa: puedes no poner type module y usar .mjs para archivos ESM. Pero es mas ordenado tener un solo estandar.

Que estudiar:
- Diferencia entre CommonJS (require) y ESM (import) - Node.js Docs Modules
- package.json fields: type, main, scripts
- npm init flags: -y para aceptar defaults

---

### Paso 2: Instalar dependencias

Que hacer:
- npm install express
- npm install express-handlebars
- npm install --save-dev nodemon dotenv

Pistas:
- express-handlebars es el motor de templates robusto con soporte para layouts y partials. Es el que usaremos en este proyecto.
- nodemon reinicia el servidor automaticamente cuando cambias archivos. Sin esto tendrias que matar el proceso manualmente cada vez.
- dotenv carga las variables del archivo .env en process.env. Sin esto las variables de entorno solo funcionarian si las seteas manualmente.
- En esta fase SOLO instalamos lo minimo para que el servidor arranque. Drizzle pg y drizzle-kit se instalan en la Fase 2 junto con la BD. Mantener las dependencias por fase evita abrumar y facilita el debugging.

Que estudiar:
- dependencies vs devDependencies - que va en cada una
- Que hace cada paquete antes de instalarlo
- node_modules y package-lock.json - para que sirven

---

### Paso 3: Crear estructura de carpetas y archivos base

Que hacer:
Crear manualmente esta estructura:
```
backend/
  src/
    app.js
    config/
      database.js
    drizzle/
      schema.js
    routes/
      auth.routes.js
      questions.routes.js
      submissions.routes.js
      scores.routes.js
    controllers/
      auth.controller.js
      questions.controller.js
      submissions.controller.js
      scores.controller.js
    services/
      sandbox.service.js
    views/
      layouts/
      partials/
      pages/
        index.hbs
  drizzle/
    .gitkeep
  .env
  .env.example
  .gitignore
  package.json
```

Comando rapido para crear la estructura (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path @(
  "backend/src/config",
  "backend/src/drizzle",
  "backend/src/routes",
  "backend/src/controllers",
  "backend/src/services",
  "backend/src/views/layouts",
  "backend/src/views/partials",
  "backend/src/views/pages",
  "backend/drizzle"
) | Out-Null
New-Item -ItemType File -Force -Path @(
  "backend/.env",
  "backend/.env.example",
  "backend/.gitignore",
  "backend/drizzle/.gitkeep",
  "backend/src/drizzle/schema.js",
  "backend/src/views/pages/index.hbs"
) | Out-Null
```

Pistas:
- Tambien puedes usar mkdir -p (bash) si prefieres. El comando de arriba es para PowerShell que es el shell de este proyecto.
- views/layouts views/partials y views/pages son para Handlebars. En este proyecto las paginas se renderizan con Handlebars como motor de templates del backend. Las vistas iran en views/pages/. Los layouts van en views/layouts/ y los partials reutilizables (header footer) en views/partials/.
- views/pages/index.hbs se crea vacio para que Handlebars tenga al menos una vistaPlaceholder requerido por el motor de templates. En el Paso 4 lo llenas con un <h1>Hello</h1>.
- Hay dos carpetas `drizzle/`: `src/drizzle/` contiene TU schema (codigo fuente que tu escribes) y `drizzle/` en la raiz contiene los archivos de migracion GENERADOS por drizzle-kit (no los editas a mano). Es la convencion de Drizzle.
- El archivo `src/drizzle/schema.js` queda vacio por ahora. Lo llenas en Fase 2 Paso 3.
- Los archivos .routes.js y .controller.js pueden estar vacios por ahora. Lo importante es que existan para mantener la disciplina de estructura.
- NOTA: El spec muestra scores.routes.js y scores.controller.js como archivos separados. En las fases la logica de scores va dentro de submissions.controller.js por simplicidad. Si prefieres separar, crea esos archivos vacios tambien.

Que estudiar:
- Patron MVC aplicado a APIs: Routes Controllers Services DB
- Por que separar routes de controllers (rutas delgadas controladores con logica)
- Que va en services vs controllers
- Handlebars: que es y como funciona (se usa para las paginas en este proyecto)
- HTML vanilla vs server-side templates (Handlebars): diferencias y cuando usar cada uno (en este proyecto se usa Handlebars segun el spec)

---

### Paso 4: Configurar app.js (Entry Point)

Que hacer:
Crear src/app.js con:
1. Importar express path fileURLToPath url (los modulos nativos url y path)
2. Crear instancia de Express
3. Configurar Handlebars como motor de plantillas (extname hbs layoutsDir partialsDir defaultLayout)
4. Agregar middlewares globales: express.json express.urlencoded
5. Agregar una ruta GET / minima para verificar que el server responde (res.json({ message: 'API Quiz-IA - OK' }))
6. Exportar app (no iniciar servidor aqui)

Tambien:
- Instalar express-handlebars (NO usar el paquete hbs - ese era para otra cosa). El paquete hbs basico no soporta layouts bien. express-handlebars si.
- Crear `src/views/layouts/main.hbs` con estructura HTML5 basica (doctype html head body con `{{{body}}}`)
- Llenar `src/views/pages/index.hbs` con un `<h1>Hello</h1>` para que Handlebars tenga al menos una vista
- NO crear `src/views/partials/navbar.hbs` todavia. Esa es creada en la Fase 10 cuando existe el navbar completo (login link admin link etc). Por ahora main.hbs no incluye `{{> navbar}}`.

Fragmentos clave:
```handlebars
{{!-- src/views/layouts/main.hbs --}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Quiz-IA</title>
</head>
<body>
  {{{body}}}
</body>
</html>
```

Fragmentos clave (codigo de app.js):
```javascript
// Para obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuracion minima de Handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: join(__dirname, 'views/layouts'),
  partialsDir: join(__dirname, 'views/partials'),
}));
app.set('view engine', 'hbs');
app.set('views', join(__dirname, 'views/pages'));
```

Pistas:
- Para obtener __dirname en ESM necesitas: const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename). Sin esto __dirname no existe en ESM.
- express-handlebars (no hbs) es el que soporta layoutsDir y partialsDir.
- El orden de los middlewares importa. Primero los parsers (json urlencoded) luego cualquier static luego routes. Express ejecuta en orden.
- Aca NO agregamos express.static porque la carpeta frontend/public NO EXISTE todavia. Si lo agregaras con path.join(__dirname ../../frontend/public) Express lanzaria un warning. Lo configuramos en la Fase 8 cuando exista el frontend.
- La ruta GET / es solo para verificar que el servidor responde. En la Fase 10 sera reemplazada por render(handlebars) cuando construyamos las paginas reales.
- Handlebars necesita que las vistas tengan extension .hbs. Sin la config extname .hbs Express no va a encontrar los templates.

Que estudiar:
- fileURLToPath y import.meta.url - por que es necesario en ESM
- Middlewares de Express: que son como funcionan next()
- Handlebars engine: app.engine app.set view engine app.set views
- Diferencia entre express.json y express.urlencoded
- Que es un layout y como funciona {{{body}}}

---

### Paso 5: Crear server.js

Que hacer:
Crear server.js en la raiz de backend/ que:
1. Importe app desde ./src/app.js
2. Importe dotenv/config (para cargar .env antes de todo)
3. Lea puerto de process.env.PORT o use 3001 por defecto
4. Inicie el servidor con app.listen y muestre un console.log con la URL

Fragmento clave:
```javascript
import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
```

Pistas:
- server.js esta separado de app.js por una razon: app.js es el setup (middlewares routes config) y server.js es el entry point que arranca todo. Esto permite testear app sin tener que levantar el servidor.
- El puerto 3001 es para evitar conflicto con el frontend si luego usas otro puerto (3000). No es obligatorio pero es buena practica.
- process.env.PORT es la variable que plataformas como Vercel setean automaticamente. En desarrollo dotenv la provee.
- El console.log con la URL es importante para que sepas que el server arranco. Sin esto puedes quedarte mirando una terminal sin saber si fallo o no.

Que estudiar:
- Separacion app/server para testing
- process.env y variables de entorno
- app.listen vs app() - cual es la diferencia

---

### Paso 6: Verificar que todo funciona

Que hacer:
1. Ejecutar npm run dev
2. Hacer GET a http://localhost:3001/
3. Confirmar que responde con JSON message API Quiz-IA - OK
4. Si falla leer el error completo y resolverlo

Errores comunes:
- ERR_MODULE_NOT_FOUND la ruta del import esta mal. Revisa si pusiste ./ al inicio.
- __dirname is not defined falta fileURLToPath + import.meta.url
- Port 3001 already in use otro proceso esta usando el puerto. Cambia el PORT o mata el proceso.
- Cannot find module express olvidaste instalar las dependencias. Corre npm install.

Que estudiar:
- Leer stack traces de Node.js (no solo la ultima linea)
- Debugging basico: console.log node --inspect

---

## Checklist de verificacion

- [ ] npm run dev inicia sin errores
- [ ] http://localhost:3001/ responde con JSON
- [ ] Estructura de carpetas completa
- [ ] Handlebars configurado (aunque no haya templates aun)
- [ ] Entiendes que hace cada archivo que creaste

---

## Errores comunes resumen

| Error                          | Causa probable                      |
|--------------------------------|-------------------------------------|
| ERR_MODULE_NOT_FOUND           | Ruta de import incorrecta           |
| __dirname is not defined       | Falta fileURLToPath en ESM          |
| Port already in use            | Otro proceso usando el puerto       |
| Cannot find module             | Falta npm install                   |
| require is not defined         | Estas usando require en ESM         |

---

## Resumen de conceptos nuevos

| Concepto                      | Por que es importante                               |
|-------------------------------|-----------------------------------------------------|
| ESM vs CJS                    | Define como importas modulos en todo el proyecto    |
| Middlewares Express            | Base de toda la logica de la API                    |
| Handlebars engine             | Motor de templates del lado servidor                |
| fileURLToPath                 | Necesario para rutas absolutas en ESM               |
| Variables de entorno          | Unica forma segura de manejar credenciales          |
| Separacion app/server         | Permite testear sin levantar servidor               |