import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';

async function main() {
  const result = await db.execute(sql`
    SELECT language, type, COUNT(*) as count
    FROM questions
    WHERE is_active = true
    GROUP BY language, type
    ORDER BY language, type
  `);

  console.log('=== Questions by language/type ===');
  for (const row of result.rows) {
    console.log(`  ${row.language} / ${row.type}: ${row.count}`);
  }

  const total = await db.execute(sql`SELECT COUNT(*) as total FROM questions WHERE is_active = true`);
  console.log(`\nTotal active: ${total.rows[0].total}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
