import { evaluateMarkup, executeJavaScript, executePostgres } from '../services/sandbox.service.js';

const HTML_TESTS = [
  { input: '', check: 'hasElement', selector: 'div', expected: true },
  { input: '', check: 'hasElement', selector: 'h1', expected: true },
  { input: '', check: 'elementText', selector: 'h1', expected: 'Bienvenidos' },
  { input: '', check: 'hasStyle', selector: 'div', property: 'display', valueContains: 'flex' },
  { input: '', check: 'hasStyle', selector: 'div', property: 'background-color', valueContains: '#87CEEB' },
  { input: '', check: 'hasStyle', selector: 'div', property: 'color', valueContains: 'white' },
  { input: '', check: 'elementInside', parent: 'div', child: 'h1', expected: true },
];

const HTML_CODE = `<div style="background-color: #87CEEB; color: white; display: flex; justify-content: center; align-items: center; height: 100vh;">
  <h1>Bienvenidos</h1>
</div>`;

const JS_CODE = `function analizarTemperaturas(temperaturas) {
  if (temperaturas.length === 0) return { promedio: null, maxima: null, minima: null };
  let suma = 0;
  let minima = temperaturas[0];
  let maxima = temperaturas[0];
  for (let temp of temperaturas) {
    suma += temp;
    if (temp < minima) minima = temp;
    if (temp > maxima) maxima = temp;
  }
  return { promedio: suma / temperaturas.length, maxima, minima };
}`;

const JS_TESTS = [
  { input: [[20, 25, 30, 18, 22, 28, 24]], expected: { promedio: 23.857142857142858, maxima: 30, minima: 18 } },
  { input: [[]], expected: { promedio: null, maxima: null, minima: null } },
  { input: [[10]], expected: { promedio: 10, maxima: 10, minima: 10 } },
];

const SQL_CODE = `CREATE TABLE productos (id INT, nombre VARCHAR(50), estado VARCHAR(20), precio INT);
INSERT INTO productos VALUES (1, 'A', 'activo', 150), (2, 'B', 'inactivo', 30), (3, 'C', 'activo', 80), (4, 'D', 'inactivo', 200), (5, 'E', 'activo', 40);`;

const SQL_TESTS = [
  { input: `SELECT * FROM productos WHERE (precio > 100 AND estado = 'activo') OR (precio < 50 AND estado = 'inactivo') ORDER BY id`, expected: [{ id: 1, nombre: 'A', estado: 'activo', precio: 150 }, { id: 2, nombre: 'B', estado: 'inactivo', precio: 30 }] },
];

async function main() {
  console.log('=== HTML/CSS markup validator ===');
  const htmlResult = evaluateMarkup(HTML_CODE, HTML_TESTS);
  console.log(`  ${htmlResult.passed}/${htmlResult.total} passed`);
  if (htmlResult.passed !== htmlResult.total) {
    for (const r of htmlResult.results) {
      console.log(`    ${r.passed ? '✓' : '✗'} ${JSON.stringify(r)}`);
    }
  }

  console.log('\n=== JavaScript executor ===');
  const jsResult = await executeJavaScript(JS_CODE, JS_TESTS);
  console.log(`  ${jsResult.passed}/${jsResult.total} passed`);
  if (jsResult.passed !== jsResult.total) {
    for (const r of jsResult.results) {
      console.log(`    ${r.passed ? '✓' : '✗'} ${JSON.stringify(r)}`);
    }
  }

  console.log('\n=== Postgres executor ===');
  const sqlResult = await executePostgres(SQL_CODE, SQL_TESTS);
  console.log(`  ${sqlResult.passed}/${sqlResult.total} passed`);
  if (sqlResult.passed !== sqlResult.total) {
    for (const r of sqlResult.results) {
      console.log(`    ${r.passed ? '✓' : '✗'} passed=${r.passed} actual=${JSON.stringify(r.actual)} ${r.error || ''}`);
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
