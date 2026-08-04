import { executePostgres } from '../services/sandbox.service.js';

const SQL_CODE = `CREATE TABLE productos (id INT, nombre VARCHAR(50), estado VARCHAR(20), precio INT);
INSERT INTO productos VALUES (1, 'A', 'activo', 150), (2, 'B', 'inactivo', 30), (3, 'C', 'activo', 80), (4, 'D', 'inactivo', 200), (5, 'E', 'activo', 40);`;

const SQL_TESTS = [
  { input: `SELECT * FROM productos WHERE (precio > 100 AND estado = 'activo') OR (precio < 50 AND estado = 'inactivo') ORDER BY id`, expected: [{ id: 1, nombre: 'A', estado: 'activo', precio: 150 }, { id: 2, nombre: 'B', estado: 'inactivo', precio: 30 }] },
];

const CTE_CODE = `CREATE TABLE productos (id INT, nombre VARCHAR(50), precio_unitario DECIMAL(10,2));
INSERT INTO productos VALUES (1, 'Laptop', 1200), (2, 'Mouse', 25), (3, 'Monitor', 300), (4, 'Teclado', 80);
CREATE TABLE ventas (id INT, id_producto INT, cantidad INT, fecha DATE);
INSERT INTO ventas VALUES (1, 1, 50), (2, 1, 80), (3, 2, 1000), (4, 3, 200), (5, 4, 600);`;

const CTE_TESTS = [
  { input: `WITH totales AS (SELECT v.id_producto, SUM(v.cantidad) AS total FROM ventas v GROUP BY v.id_producto) SELECT p.nombre, t.total FROM productos p JOIN totales t ON p.id = t.id_producto WHERE t.total > 500 ORDER BY t.total DESC`, expected: [{ nombre: 'Mouse', total: 1000 }, { nombre: 'Teclado', total: 600 }] },
];

const CAT_CODE = `CREATE TABLE products (id INT, name VARCHAR(50), category VARCHAR(50));
INSERT INTO products VALUES (1, 'Mouse', 'Periféricos'), (2, 'Teclado', 'Periféricos'), (3, 'Monitor', 'Pantallas'), (4, 'Webcam', 'Periféricos');
CREATE TABLE order_items (id INT, order_id INT, product_id INT, quantity INT);
INSERT INTO order_items VALUES (1, 101, 1, 10), (2, 102, 2, 5), (3, 103, 3, 20), (4, 104, 1, 15), (5, 105, 4, 8);`;

const CAT_TESTS = [
  { input: `SELECT p.name, SUM(oi.quantity) AS total FROM products p JOIN order_items oi ON oi.product_id = p.id GROUP BY p.name ORDER BY total DESC LIMIT 3`, expected: [{ name: 'Mouse', total: 25 }, { name: 'Monitor', total: 20 }, { name: 'Webcam', total: 8 }] },
];

const r1 = await executePostgres(SQL_CODE, SQL_TESTS);
console.log(`WHERE test: ${r1.passed}/${r1.total} passed`);
r1.results.forEach((r, i) => console.log(`  ${r.passed ? '✓' : '✗'} ${r.actual ? JSON.stringify(r.actual.slice(0, 2)) : r.error}`));

const r2 = await executePostgres(CTE_CODE, CTE_TESTS);
console.log(`\nCTE test: ${r2.passed}/${r2.total} passed`);
r2.results.forEach((r, i) => console.log(`  ${r.passed ? '✓' : '✗'} ${r.actual ? JSON.stringify(r.actual) : r.error}`));

const r3 = await executePostgres(CAT_CODE, CAT_TESTS);
console.log(`\nCategory test: ${r3.passed}/${r3.total} passed`);
r3.results.forEach((r, i) => console.log(`  ${r.passed ? '✓' : '✗'} ${r.actual ? JSON.stringify(r.actual) : r.error}`));
