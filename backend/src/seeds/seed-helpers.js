import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from '../config/database.js';
import { questions, quizzes, quizQuestions, submissions, users, session } from '../drizzle/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function runBackup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `pre-seed-${ts()}.json`);
  const dump = {
    meta: { created_at: new Date().toISOString(), source: 'wipe-and-seed.js' },
    questions: await db.select().from(questions),
    quizzes: await db.select().from(quizzes),
    quiz_questions: await db.select().from(quizQuestions),
    submissions: await db.select().from(submissions),
    users: await db.select().from(users),
    session: await db.select().from(session),
  };
  writeFileSync(file, JSON.stringify(dump, null, 2));
  console.log(`[seed-snapshot] Saved: ${file} (${dump.questions.length} questions, ${dump.quizzes.length} quizzes, ${dump.submissions.length} submissions)`);
  return file;
}
