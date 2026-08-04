import { chromium } from 'playwright';
import { db, pool } from '../src/config/database.js';
import { sql, eq, and } from 'drizzle-orm';
import { questions, quizzes, quizQuestions } from '../src/drizzle/schema.js';

const BASE = 'http://localhost:3001';

async function createQuiz() {
  const r = await db.select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.language, 'git'), eq(questions.isActive, true)))
    .orderBy(sql`RANDOM()`)
    .limit(5);
  const [quiz] = await db.insert(quizzes).values({ userId: null, language: 'git' }).returning();
  await db.insert(quizQuestions).values(
    r.map((q, idx) => ({ quizId: quiz.id, questionId: q.id, order: idx + 1 }))
  );
  return quiz.id;
}

async function getAnswers(quizId) {
  const r = await db.execute(sql`
    SELECT qq.order, q.correct_option
    FROM quiz_questions qq
    JOIN questions q ON q.id = qq.question_id
    WHERE qq.quiz_id = ${quizId} ORDER BY qq.order
  `);
  return r.rows;
}

const log = (msg, ok = true) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function run() {
  console.log('=== Test corazones: respuesta incorrecta debe decrementar vidas ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  page.on('pageerror', (e) => console.log('[PAGE ERROR]', e.message));

  try {
    const quizId = await createQuiz();
    console.log(`  quizId = ${quizId}`);
    const answers = await getAnswers(quizId);
    console.log(`  Q1 correctOption = ${answers[0].correct_option}`);

    await page.goto(`${BASE}/quiz?quizId=${quizId}`);
    await page.waitForSelector('#question-title', { timeout: 10000 });
    await page.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );

    const heartsBefore = await page.locator('#hearts .heart').evaluateAll((els) =>
      els.map((el) => el.classList.contains('lost'))
    );
    console.log(`  Corazones iniciales: lost=${JSON.stringify(heartsBefore)}`);
    log(`  5 corazones, todos full`, heartsBefore.filter(Boolean).length === 0);

    const wrongIdx = answers[0].correct_option === 0 ? 1 : 0;
    await page.locator('#options-container button.option-btn').nth(wrongIdx).click();
    console.log(`  Click en opción incorrecta (${wrongIdx})`);
    await page.click('#submit-btn');
    console.log('  Submit clickeado...');

    await page.waitForFunction(
      () => {
        const z = document.getElementById('answer-zone');
        return z?.querySelector('.is-error');
      },
      { timeout: 10000 }
    );

    await page.waitForTimeout(800);

    const heartsAfter = await page.locator('#hearts .heart').evaluateAll((els) =>
      els.map((el) => el.classList.contains('lost'))
    );
    console.log(`  Corazones después:   lost=${JSON.stringify(heartsAfter)}`);

    const lostCount = heartsAfter.filter(Boolean).length;
    log(`  Exactamente 1 corazón perdido`, lostCount === 1);

    const r = await db.execute(sql`SELECT attempts_left FROM quizzes WHERE id = ${quizId}`);
    console.log(`  attempts_left en BD: ${r.rows[0].attempts_left}`);
    log(`  BD attempts_left = 4 (era 5, decremento en 1)`, r.rows[0].attempts_left === 4);

    console.log('\n-- Probando 2da respuesta incorrecta --');
    await page.waitForFunction(
      () => {
        const z = document.getElementById('answer-zone');
        return z?.querySelector('#submit-btn') && !z.querySelector('#submit-btn').disabled;
      },
      { timeout: 5000 }
    );

    await page.locator('#options-container button.option-btn').nth(wrongIdx).click();
    await page.click('#submit-btn');

    await page.waitForFunction(
      () => {
        const z = document.getElementById('answer-zone');
        const errVisible = z?.querySelector('.is-error');
        if (!errVisible) return false;
        const hearts = Array.from(document.querySelectorAll('#hearts .heart'));
        return hearts.filter((h) => h.classList.contains('lost')).length === 2;
      },
      { timeout: 10000 }
    );

    const heartsAfter2 = await page.locator('#hearts .heart').evaluateAll((els) =>
      els.map((el) => el.classList.contains('lost'))
    );
    console.log(`  Corazones tras 2do mal: lost=${JSON.stringify(heartsAfter2)}`);
    log(`  Exactamente 2 corazones perdidos`, heartsAfter2.filter(Boolean).length === 2);

    const r2 = await db.execute(sql`SELECT attempts_left FROM quizzes WHERE id = ${quizId}`);
    console.log(`  attempts_left en BD: ${r2.rows[0].attempts_left}`);
    log(`  BD attempts_left = 3`, r2.rows[0].attempts_left === 3);

    await pool.end();
    await browser.close();

    if (process.exitCode) {
      console.log('\n❌ FAIL: decremento de vidas no funciona como esperado');
    } else {
      console.log('\n✅ Las vidas se decrementan correctamente con respuestas incorrectas');
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    await page.screenshot({ path: 'tests/debug-hearts.png', fullPage: true }).catch(() => {});
    await pool.end();
    await browser.close();
    process.exit(1);
  }
}

run();
