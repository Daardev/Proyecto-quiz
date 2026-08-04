import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';

async function main() {
  try {
    console.log('[cleanup] Reasignando questions de categorias duplicadas al ID menor...');
    await db.execute(sql`
      UPDATE questions q
      SET category_id = canonical.min_id
      FROM (
        SELECT MIN(id) AS min_id, technology_id, name
        FROM categories
        GROUP BY technology_id, name
      ) canonical
      JOIN categories c ON c.technology_id = canonical.technology_id AND c.name = canonical.name
      WHERE q.category_id = c.id AND c.id <> canonical.min_id
    `);
    console.log('[cleanup] Questions reasignadas');

    console.log('[cleanup] Eliminando categorías duplicadas...');
    await db.execute(sql`
      DELETE FROM categories
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM categories
        GROUP BY technology_id, name
      )
    `);
    console.log('[cleanup] Duplicados eliminados');

    console.log('[cleanup] Agregando UNIQUE constraint en (technology_id, name)...');
    await db.execute(sql`
      ALTER TABLE categories
      ADD CONSTRAINT categories_tech_name_unique UNIQUE (technology_id, name)
    `);
    console.log('[cleanup] Constraint agregado');
    process.exit(0);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('[cleanup] Constraint ya existe');
      process.exit(0);
    }
    console.error('[cleanup] Error:', err.message);
    process.exit(1);
  }
}
main();
