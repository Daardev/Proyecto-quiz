import { executeJavaScript, executePostgres } from '../services/sandbox.service.js';

const CODE = `
function analizarTemperaturas(temperaturas) {
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

const TESTS = [
  { input: [[20, 25, 30, 18, 22, 28, 24]], expected: { promedio: 23.857142857142858, maxima: 30, minima: 18 } },
  { input: [[]], expected: { promedio: null, maxima: null, minima: null } },
  { input: [[10]], expected: { promedio: 10, maxima: 10, minima: 10 } },
];

const result = await executeJavaScript(CODE, TESTS);
console.log(`analyze: ${result.passed}/${result.total} passed`);
result.results.forEach((r, i) => {
  console.log(`  ${r.passed ? '✓' : '✗'} ${JSON.stringify(r.actual)}${r.error ? ' err: ' + r.error : ''}`);
});

const SQL_CODE = `
CREATE TABLE scores (id INTEGER PRIMARY KEY, player TEXT, score INTEGER);
INSERT INTO scores VALUES (1, 'Alice', 100), (2, 'Bob', 85), (3, 'Charlie', 95), (4, 'Diana', 110);`;

const SQL_TESTS = [
  { input: 'SELECT player FROM scores ORDER BY score DESC LIMIT 2', expected: [{ player: 'Diana' }, { player: 'Alice' }] }
];

const sqlResult = await executePostgres(SQL_CODE, SQL_TESTS);
console.log(`\nSQL: ${sqlResult.passed}/${sqlResult.total} passed`);
sqlResult.results.forEach((r, i) => {
  console.log(`  ${r.passed ? '✓' : '✗'} ${JSON.stringify(r.actual)}${r.error ? ' err: ' + r.error : ''}`);
});
