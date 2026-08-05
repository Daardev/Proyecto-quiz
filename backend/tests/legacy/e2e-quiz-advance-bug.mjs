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
  if (r.length < 5) throw new Error('Necesita 5 preguntas git activas');

  const [quiz] = await db.insert(quizzes).values({ userId: null, language: 'git' }).returning();
  await db.insert(quizQuestions).values(
    r.map((q, idx) => ({ quizId: quiz.id, questionId: q.id, order: idx + 1 }))
  );
  return quiz.id;
}

async function getCorrectAnswers(quizId) {
  const r = await db.execute(sql`
    SELECT qq.order AS order, q.type AS type, q.correct_option AS correct_option, q.id AS qid
    FROM quiz_questions qq
    JOIN questions q ON q.id = qq.question_id
    WHERE qq.quiz_id = ${quizId}
    ORDER BY qq.order
  `);
  return r.rows;
}

const log = (msg, ok = true) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function run() {
  console.log('=== Bug Repro: quiz.hbs loadQuestion always shows firstQuestion ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push('[console.error] ' + msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('[pageerror] ' + err.message));

  try {
    console.log('-- Creando quiz de 5 preguntas de git --');
    const quizId = await createQuiz();
    console.log(`  quizId = ${quizId}`);

    const answers = await getCorrectAnswers(quizId);
    console.log(`  Respuestas correctas cargadas: ${answers.length}`);
    answers.forEach(a => console.log(`    Q${a.order}: type=${a.type} correctOption=${a.correct_option}`));

    console.log('\n-- Navegando a /quiz --');
    await page.goto(`${BASE}/quiz?quizId=${quizId}`);
    await page.waitForSelector('#question-title', { timeout: 10000 });
    await page.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );

    const q1Title = await page.locator('#question-title').textContent();
    const q1Progress = await page.locator('#progress').textContent();
    console.log(`  Q1 title: "${q1Title.substring(0, 60)}..."`);
    console.log(`  Q1 progress: ${q1Progress}`);

    console.log('\n-- Respondiendo Q1 con respuesta CORRECTA --');
    const q1 = answers[0];
    if (q1.type === 'multiple_choice') {
      const buttons = page.locator('#options-container button.option-btn');
      const count = await buttons.count();
      log(`Botones de opción: ${count}`, count >= 2);
      await buttons.nth(q1.correct_option).click();
      console.log(`  Click en opción ${q1.correct_option}`);
    } else {
      console.log(`  Q1 es código — saltando (no aplica para este test)`);
      await pool.end();
      await browser.close();
      return;
    }

    await page.click('#submit-btn');
    console.log('  Submit clickeado, esperando transición...');

    await page.waitForFunction(
      (prevTitle) => {
        const t = document.getElementById('question-title');
        const p = document.getElementById('progress');
        const cur = t?.textContent.trim() || '';
        const prog = p?.textContent.trim() || '';
        return cur !== prevTitle && cur !== 'Cargando…';
      },
      q1Title,
      { timeout: 15000 }
    ).catch(() => null);

    await page.waitForTimeout(500);

    const newTitle = await page.locator('#question-title').textContent();
    const newProgress = await page.locator('#progress').textContent();

    console.log('\n-- Después de respuesta correcta --');
    console.log(`  Q1 era:    "${q1Title.substring(0, 60)}..."`);
    console.log(`  Ahora es:  "${newTitle.substring(0, 60)}..."`);
    console.log(`  Progress:  ${newProgress}`);

    const titleChanged = newTitle !== q1Title;
    const progressAdvanced = !newProgress.includes('1 /');

    log(`Q2 title ≠ Q1 title (no loop): ${titleChanged}`, titleChanged);
    log(`Progress avanzó (no "1 / 5"):  ${progressAdvanced}`, progressAdvanced);

    if (!titleChanged) {
      console.log('\n❌ BUG CONFIRMADO: la misma pregunta se muestra después de respuesta correcta');
      console.log('   Causa: `const firstQuestion` en quiz.hbs no se nullea, loadQuestion()');
      console.log('   siempre usa el JSON server-rendered en vez de llamar a /api/quizzes/:id/current');
    } else {
      console.log('\n✅ El quiz avanza correctamente después de respuesta correcta');
    }

    console.log('\n-- Verificando corazones --');
    const hearts = await page.locator('#hearts .heart').evaluateAll((els) =>
      els.map((el) => ({ lost: el.classList.contains('lost'), full: el.classList.contains('full') }))
    );
    console.log(`  Estado actual de corazones: ${JSON.stringify(hearts)}`);
    log(`  5 corazones presentes`, hearts.length === 5);

    await pool.end();
    await browser.close();

    if (consoleErrors.length > 0) {
      console.log('\n=== Console errors capturados ===');
      consoleErrors.forEach((e) => console.log(' ', e));
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    console.error(err.stack);
    await page.screenshot({ path: 'tests/debug-bug-repro.png', fullPage: true }).catch(() => {});
    await pool.end();
    await browser.close();
    process.exit(1);
  }
}

run();
