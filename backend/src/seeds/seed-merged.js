import 'dotenv/config';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions } from '../drizzle/schema.js';
import { getTestsForQuestion } from '../services/tests-loader.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function main() {
  const jsonPath = path.join(__dirname, 'questions-batch.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`[seed-merged] Procesando ${data.length} preguntas desde JSON...`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let tested = 0;

  for (const q of data) {
    const hash = md5((q.title || '') + (q.description || ''));
    const language = q.language || 'javascript';

    const existing = await db.query.questions.findFirst({
      where: eq(questions.hash, hash),
    });

    let resolvedTestsTemplate = null;
    let resolvedSolutions = null;

    if (q.type === 'code') {
      const existingId = existing?.id;
      let candidateId = existingId;

      if (!candidateId) {
        const [peek] = await db.select({ id: questions.id }).from(questions).where(eq(questions.hash, hash)).limit(1);
        candidateId = peek?.id;
      }

      if (candidateId) {
        const testsFromFile = getTestsForQuestion(language, candidateId);
        if (testsFromFile) {
          resolvedTestsTemplate = testsFromFile;
          resolvedSolutions = [
            {
              label: 'Solución principal',
              code: q.solution || (q.starterCode ? `${q.starterCode}\n${q.description}` : q.description) || '',
              tests: testsFromFile,
            },
          ];
          tested++;
        }
      }
    }

    const insertData = {
      language,
      type: q.type || 'code',
      title: q.title || '',
      description: q.description || '',
      starterCode: q.starterCode || null,
      setupCode: q.setupCode || null,
      testsTemplate: resolvedTestsTemplate,
      options: q.options || null,
      correctOption: q.correctOption ?? null,
      solution: q.solution || null,
      solutions: resolvedSolutions,
      isActive: true,
      hash,
    };

    if (existing) {
      const updates = {};
      if (language && existing.language !== language) updates.language = language;
      if (q.solution && !existing.solution) updates.solution = q.solution;
      if (resolvedTestsTemplate && !existing.testsTemplate) updates.testsTemplate = resolvedTestsTemplate;
      if (q.starterCode && !existing.starterCode) updates.starterCode = q.starterCode;
      if (q.setupCode && !existing.setupCode) updates.setupCode = q.setupCode;
      if (q.correctOption !== null && q.correctOption !== undefined && existing.correctOption === null) {
        updates.correctOption = q.correctOption;
      }
      const existingSolutions = Array.isArray(existing.solutions) ? existing.solutions : [];
      const existingEmpty = existingSolutions.length === 0;
      const sameAsJson = JSON.stringify(existingSolutions) === JSON.stringify(resolvedSolutions);
      if (resolvedSolutions && (existingEmpty || !sameAsJson)) {
        updates.solutions = resolvedSolutions;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(questions).set(updates).where(eq(questions.hash, hash));
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.insert(questions).values(insertData);
      inserted++;
    }
  }

  console.log(`[seed-merged] ${inserted} nuevas, ${updated} actualizadas, ${skipped} sin cambios`);
  console.log(`[seed-merged] Tests cargados desde tests/<lang>.json: ${tested}/${data.filter((q) => q.type === 'code').length} code questions`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-merged] Error:', err);
  process.exit(1);
});
