import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';

async function main() {
  const result = await db.execute(sql`
    SELECT id, language, title, hash, md5(title || description) as computed_hash
    FROM questions
    WHERE language = 'javascript'
  `);
  console.log(`Total javascript questions: ${result.rows.length}`);
  for (const row of result.rows) {
    console.log(`  id=${row.id} hash=${row.hash} computed=${row.computed_hash} title=${row.title}`);
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
