import { chromium } from 'playwright';
import { db, pool } from '../src/config/database.js';
import { quizzes, quizQuestions } from '../src/drizzle/schema.js';

const BASE = 'http://localhost:3001';

async function createPreviewQuiz(questionId, language) {
  const [quiz] = await db.insert(quizzes).values({ userId: null, language }).returning();
  await db.insert(quizQuestions).values([{ quizId: quiz.id, questionId, order: 1 }]);
  return quiz.id;
}

const log = (msg, ok = true) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function run() {
  console.log('=== E2E: pregunta id=67 (INSERT con subconsulta) ===\n');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  try {
    const quizId = await createPreviewQuiz(67, 'sql');
    console.log(`quizId: ${quizId}`);

    await page.goto(`${BASE}/quiz?quizId=${quizId}`);
    await page.waitForSelector('#question-title', { timeout: 10000 });
    await page.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );
    const title = await page.locator('#question-title').textContent();
    log(`Pregunta cargada: "${title.substring(0, 50)}..."`, title.length > 0);

    const starter = await page.evaluate(() => document.querySelector('textarea.inputarea')?.value || '');
    log(`starterCode presente (length=${starter.length})`, starter.length > 0);

    const solutionQuery = `WITH totales AS (\n  SELECT dp.id_producto, SUM(dp.cantidad) AS total FROM Detalle_Pedido dp JOIN Pedidos p ON dp.id_pedido = p.id WHERE EXTRACT(YEAR FROM p.fecha) = 2024 GROUP BY dp.id_producto\n) INSERT INTO destacados (id_producto) SELECT id_producto FROM totales WHERE total > 2000`;
    await page.evaluate((args) => {
      const ta = document.querySelector('textarea.inputarea');
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      if (editor) editor.setValue(args.fullCode);
      else if (ta) ta.value = args.fullCode;
    }, { fullCode: starter + '\n' + solutionQuery });
    log('Solución insertada en editor', true);

    await page.click('#submit-btn');

    const response = await page.waitForResponse(
      (r) => r.url().includes(`/api/quizzes/${quizId}/submit`),
      { timeout: 15000 }
    );
    const body = await response.json();
    log(`API status: ${response.status()}`, response.status() === 200);
    log(`isCorrect: ${body.isCorrect}`, body.isCorrect === true);
    log(`testsPassed: ${body.testsPassed}/${body.testsTotal}`, body.testsPassed === body.testsTotal);

    await browser.close();
    await pool.end();

    if (process.exitCode) console.log('\n❌ FAIL');
    else console.log('\n✓ Pregunta id=67 también pasa');
  } catch (err) {
    console.error('Error fatal:', err.message);
    await page.screenshot({ path: 'tests/debug-q67-ui.png', fullPage: true }).catch(() => {});
    await browser.close();
    await pool.end();
    process.exit(1);
  }
}

run();
