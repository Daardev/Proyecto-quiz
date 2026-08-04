import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { sql, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions } from '../drizzle/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function migrate() {
  console.log('[migrate] ADD COLUMN solution (idempotente)...');
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution TEXT`);
  console.log('[migrate] OK');
}

async function populateSolutions() {
  const jsonPath = path.join(__dirname, 'questions-batch.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`[populate] Sincronizando solutions de ${data.length} preguntas desde JSON...`);

  let updated = 0;
  let missing = 0;

  for (const q of data) {
    if (!q.solution) continue;

    const hash = md5(q.title + q.description);
    const result = await db.update(questions)
      .set({ solution: q.solution })
      .where(eq(questions.hash, hash));

    if (result && typeof result === 'object' && 'rowCount' in result) {
      if (result.rowCount > 0) updated++;
      else missing++;
    } else {
      updated++;
    }
  }

  console.log(`[populate] ${updated} actualizadas, ${missing} no encontradas en BD`);
}

async function main() {
  console.log('=== MIGRATE: add solution column + populate from JSON (no destructivo) ===\n');
  await migrate();
  console.log();
  await populateSolutions();
  console.log();
  console.log('=== Listo ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
