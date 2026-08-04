import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions } from '../drizzle/schema.js';
import { getTestsForQuestion, reloadTestsCache } from '../services/tests-loader.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function migrate() {
  console.log('[migrate] Borrando tablas obsoletas (categories, technologies)...');
  await db.execute(sql`DROP TABLE IF EXISTS categories CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS technologies CASCADE`);
  console.log('[migrate] DROP COLUMN obsoletas (si existen)...');
  await db.execute(sql`ALTER TABLE questions DROP COLUMN IF EXISTS difficulty`);
  await db.execute(sql`ALTER TABLE questions DROP COLUMN IF EXISTS category_id`);
  await db.execute(sql`ALTER TABLE quizzes DROP COLUMN IF EXISTS technology_id`);
  await db.execute(sql`ALTER TABLE quizzes DROP COLUMN IF EXISTS category_id`);
  console.log('[migrate] ADD COLUMN language...');
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS language varchar(20) NOT NULL DEFAULT 'javascript'`);
  await db.execute(sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS language varchar(20) NOT NULL DEFAULT 'javascript'`);
  console.log('[migrate] ADD COLUMN solution...');
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution TEXT`);
  console.log('[migrate] Wipe data...');
  await db.execute(sql`TRUNCATE TABLE submissions, quiz_questions, quizzes, questions RESTART IDENTITY CASCADE`);
  console.log('[migrate] OK');
}

async function seedQuestions() {
  reloadTestsCache();
  const jsonPath = path.join(__dirname, 'questions-batch.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`[seed] Insertando ${data.length} preguntas con campo language...`);

  let inserted = 0;
  let skipped = 0;
  let testsLoaded = 0;

  for (let i = 0; i < data.length; i++) {
    const q = data[i];
    const hash = md5(q.title + q.description);
    const language = q.language;
    const insertData = {
      language,
      type: q.type,
      title: q.title,
      description: q.description,
      hash,
    };

    if (q.type === 'multiple_choice') {
      insertData.options = q.options;
      insertData.correctOption = q.correctOption;
      insertData.starterCode = null;
      insertData.testsTemplate = null;
    } else {
      insertData.starterCode = q.starterCode;
      insertData.setupCode = q.setupCode || null;
      insertData.options = null;
      insertData.correctOption = null;
      insertData.solution = q.solution || null;
      const questionId = i + 1;
      const testsFromFile = getTestsForQuestion(language, questionId);
      if (testsFromFile) {
        insertData.testsTemplate = testsFromFile;
        insertData.solutions = [{ label: 'Solución principal', code: q.solution || '', tests: testsFromFile }];
        testsLoaded++;
      } else {
        insertData.testsTemplate = null;
        insertData.solutions = null;
      }
    }

    try {
      await db.insert(questions).values(insertData);
      inserted++;
    } catch (err) {
      console.error(`[seed] Error insertando "${q.title}":`, err.message);
      skipped++;
    }
  }

  console.log(`[seed] ${inserted} preguntas insertadas, ${skipped} saltadas`);
  console.log(`[seed] Tests cargados desde tests/<lang>.json: ${testsLoaded}`);
}

async function main() {
  console.log('=== MIGRATE + SEED: simplificado (sin categorias/technologies/difficulty) ===\n');
  await migrate();
  console.log();
  await seedQuestions();
  console.log();
  console.log('=== Listo ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
