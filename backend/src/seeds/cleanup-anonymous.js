import 'dotenv/config';
import { sql, and, isNull, lt, eq, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { quizzes, quizQuestions, submissions } from '../drizzle/schema.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 7;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' || args[i] === '-d') {
      const v = parseInt(args[i + 1], 10);
      if (Number.isFinite(v) && v > 0) days = v;
    }
    if (args[i] === '--dry-run') {
      process.env.DRY_RUN = '1';
    }
  }
  return { days, dryRun: !!process.env.DRY_RUN };
}

async function cleanup() {
  const { days, dryRun } = parseArgs();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  console.log(`[cleanup] Buscando quizzes anónimos con started_at < ${cutoff.toISOString()} (${days} días)...`);

  const oldQuizzes = await db.select({ id: quizzes.id, startedAt: quizzes.startedAt })
    .from(quizzes)
    .where(and(isNull(quizzes.userId), lt(quizzes.startedAt, cutoff)));

  if (oldQuizzes.length === 0) {
    console.log('[cleanup] Nada que limpiar.');
    return;
  }

  console.log(`[cleanup] Encontrados ${oldQuizzes.length} quizzes anónimos viejos.`);
  if (dryRun) {
    console.log('[cleanup] (DRY RUN — no se elimina nada)');
    for (const q of oldQuizzes) {
      console.log(`  - quiz id=${q.id} started_at=${q.startedAt?.toISOString()}`);
    }
    return;
  }

  const ids = oldQuizzes.map(q => q.id);
  const qqRows = await db.select({ id: quizQuestions.id }).from(quizQuestions).where(inArray(quizQuestions.quizId, ids));
  const qqIds = qqRows.map(r => r.id);

  if (qqIds.length > 0) {
    const deletedSubs = await db.delete(submissions).where(inArray(submissions.quizQuestionId, qqIds)).returning({ id: submissions.id });
    console.log(`[cleanup] Eliminadas ${deletedSubs.length} submissions`);
  }

  const deletedQQ = await db.delete(quizQuestions).where(inArray(quizQuestions.quizId, ids)).returning({ id: quizQuestions.id });
  console.log(`[cleanup] Eliminados ${deletedQQ.length} quiz_questions`);

  const deletedQ = await db.delete(quizzes).where(inArray(quizzes.id, ids)).returning({ id: quizzes.id });
  console.log(`[cleanup] Eliminados ${deletedQ.length} quizzes anónimos`);

  console.log('[cleanup] Listo.');
}

cleanup().then(() => process.exit(0)).catch(err => {
  console.error('[cleanup] Error:', err);
  process.exit(1);
});
