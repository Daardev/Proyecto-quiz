import 'dotenv/config';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db, pool } from '../config/database.js';
import { questions } from '../drizzle/schema.js';
import { regenerateAllTestsFiles, getTestEntry } from '../services/question-export.js';
import { runBackup } from './seed-helpers.js';

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

function buildSolutions(q, testsFromFile) {
  if (!testsFromFile) return null;
  if (Array.isArray(q.solutions) && q.solutions.length > 0) {
    return q.solutions.map((sol, idx) => ({
      label: sol.label || `Solución ${idx + 1}`,
      code: sol.code || '',
      tests: testsFromFile,
    }));
  }
  return [{ label: 'Solución principal', code: q.solution || '', tests: testsFromFile }];
}

async function migrateSchema() {
  console.log('[migrate] Aplicando migración de schema (idempotente)...');
  await db.execute(sql`DROP TABLE IF EXISTS categories CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS technologies CASCADE`);
  await db.execute(sql`ALTER TABLE questions DROP COLUMN IF EXISTS difficulty`);
  await db.execute(sql`ALTER TABLE questions DROP COLUMN IF EXISTS category_id`);
  await db.execute(sql`ALTER TABLE quizzes DROP COLUMN IF EXISTS technology_id`);
  await db.execute(sql`ALTER TABLE quizzes DROP COLUMN IF EXISTS category_id`);
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS language varchar(20) NOT NULL DEFAULT 'javascript'`);
  await db.execute(sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS language varchar(20) NOT NULL DEFAULT 'javascript'`);
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution TEXT`);
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS setup_code TEXT`);
  await db.execute(sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await db.execute(sql`DELETE FROM submissions a USING submissions b WHERE a.quiz_question_id = b.quiz_question_id AND a.id < b.id`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS submissions_quiz_question_id_key ON submissions (quiz_question_id)`);
  console.log('[migrate] OK');
}

async function archiveMissingQuestions(hashesInJson, dryRun) {
  const allActive = await db.select().from(questions).where(isNull(questions.archivedAt));
  let archived = 0;
  for (const q of allActive) {
    if (!hashesInJson.has(q.hash)) {
      if (!dryRun) {
        await db.update(questions).set({ archivedAt: new Date() }).where(eq(questions.id, q.id));
      }
      archived++;
    }
  }
  return archived;
}

async function seedFromDb(dryRun = false) {
  console.log(`[seed] ${dryRun ? '[DRY-RUN] ' : ''}Leyendo preguntas de la BD...`);

  const rows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.isActive, true), isNull(questions.archivedAt)));

  console.log(`[seed] ${rows.length} preguntas activas encontradas en la BD`);

  const hashesInJson = new Set();
  let stats = { inserted: 0, updated: 0, errors: 0 };

  for (const q of rows) {
    const hash = md5(q.title + q.description);
    hashesInJson.add(hash);
    let existing = await db.select().from(questions).where(eq(questions.id, q.id));
    if (existing.length === 0) {
      existing = await db.select().from(questions).where(eq(questions.hash, hash));
    }
    const stableId = existing.length > 0 ? existing[0].id : q.id;
    const testsFromFile = getTestEntry(q.language, stableId);

    try {
      const data = {
        language: q.language,
        type: q.type,
        title: q.title,
        description: q.description,
        hash,
      };

      if (q.type === 'multiple_choice') {
        data.options = q.options;
        data.correctOption = q.correctOption;
        data.starterCode = null;
        data.editorStarterCode = null;
        data.setupCode = null;
        data.testsTemplate = null;
        data.solutions = null;
        data.solution = null;
      } else {
        data.starterCode = q.starterCode;
        data.editorStarterCode = q.editorStarterCode || null;
        data.setupCode = q.setupCode || null;
        data.options = null;
        data.correctOption = null;
        data.solution = q.solution || null;
        data.testsTemplate = testsFromFile || null;
        data.solutions = buildSolutions(q, testsFromFile);
      }

      if (existing.length > 0) {
        if (!dryRun) {
          await db.update(questions).set(data).where(eq(questions.id, existing[0].id));
        }
        stats.updated++;
      } else {
        if (!dryRun) {
          await db.insert(questions).values({ ...data, id: stableId });
        }
        stats.inserted++;
      }
    } catch (err) {
      console.error(`[seed] Error procesando "${q.title}":`, err.message);
      stats.errors++;
    }
  }

  if (!dryRun) {
    const archived = await archiveMissingQuestions(hashesInJson, dryRun);
    if (archived > 0) {
      console.log(`[seed] ${archived} preguntas archivadas (sin match en BD activa)`);
    }
    await regenerateAllTestsFiles();
  }

  console.log(`[seed] ${dryRun ? '[DRY-RUN] ' : ''}inserted: ${stats.inserted}, updated: ${stats.updated}, errors: ${stats.errors}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== SEED FROM DB: BD como fuente de verdad ===\n');

  if (dryRun) {
    console.log('*** MODO DRY-RUN: no se realizarán cambios en la BD ***\n');
  } else {
    console.log('*** Backup automático antes de cambios ***\n');
    await runBackup();
  }

  await migrateSchema();
  console.log();

  await seedFromDb(dryRun);
  console.log();
  console.log('=== Listo ===');

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
