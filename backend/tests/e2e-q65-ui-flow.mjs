import { chromium } from 'playwright';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/config/database.js';
import { quizzes, quizQuestions, submissions } from '../src/drizzle/schema.js';

const BASE = 'http://localhost:3001';

const SOLUTION_SQL = `WITH facturacion_2024 AS (
  SELECT dp.id_producto, (SUM(dp.cantidad * dp.precio_unitario))::int AS total
  FROM Detalle_Pedido dp
  JOIN Pedidos pe ON pe.id = dp.id_pedido
  WHERE EXTRACT(YEAR FROM pe.fecha) = 2024
  GROUP BY dp.id_producto
)
SELECT pr.nombre AS nombre_producto, f.total
FROM productos pr
JOIN facturacion_2024 f ON pr.id = f.id_producto
WHERE f.total > 50000
ORDER BY f.total ASC;`;

const log = (msg, ok = true) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function run() {
  console.log('=== E2E: pregunta id=65 (SQL HAVING — happy path) ===\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  let quizId;
  try {
    const [quiz] = await db.insert(quizzes).values({ userId: null, language: 'sql' }).returning();
    quizId = quiz.id;
    await db.insert(quizQuestions).values([{ quizId: quiz.id, questionId: 65, order: 1 }]);
    log(`Quiz preview creado: id=${quiz.id}`, true);

    await page.goto(`${BASE}/quiz?quizId=${quiz.id}`);
    await page.waitForSelector('#question-title', { timeout: 10000 });
    await page.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );

    const title = await page.locator('#question-title').textContent();
    const language = await page.locator('#language-tag').textContent();
    const progress = await page.locator('#progress').textContent();
    log(`Pregunta cargada: "${title.substring(0, 50)}..."`, title.length > 0);
    log(`Language tag: "${language}"`, language.includes('sql'));
    log(`Progress: "${progress}"`, progress.includes('1 /'));

    const starter = await page.evaluate(() => {
      const ta = document.querySelector('textarea.inputarea');
      return ta?.value || '';
    });
    log(`StarterCode presente (length=${starter.length})`, starter.length > 0);

    await page.evaluate((args) => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      if (editor) {
        editor.setValue(args.fullCode);
      } else {
        const ta = document.querySelector('textarea.inputarea');
        if (ta) ta.value = args.fullCode;
      }
    }, { fullCode: starter + '\n' + SOLUTION_SQL });
    log('Solución canónica insertada en el editor', true);

    const editorValue = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      const taValue = document.querySelector('textarea.inputarea')?.value || '';
      if (editor) {
        const editorValue = editor.getValue();
        return { source: 'monaco', value: editorValue, taValue };
      }
      return { source: 'textarea', value: taValue, taValue };
    });
    log(`Editor source: ${editorValue.source}`, true);
    log(`Monaco/textarea value length: ${editorValue.value?.length || 0}`, true);
    log(`Underlying textarea value length: ${editorValue.taValue?.length || 0}`, true);
    log(`Includes expected SELECT: ${editorValue.value?.includes('SELECT pr.nombre AS nombre_producto, f.total')}`, true);
    log(`Includes outdated SELECT: ${editorValue.value?.includes('SELECT f.total, pr.nombre AS nombre_producto')}`, true);
    console.log('=== Last 300 chars of Monaco value ===');
    console.log(editorValue.value?.substring(Math.max(0, (editorValue.value?.length || 0) - 300)));

    await page.click('#submit-btn');

    const response = await page.waitForResponse(
      (r) => r.url().includes(`/api/quizzes/${quiz.id}/submit`),
      { timeout: 15000 }
    );
    const requestBody = response.request().postDataJSON();
    console.log('=== Request body sent to API ===');
    console.log('  questionId:', requestBody?.questionId);
    console.log('  code length:', requestBody?.code?.length);
    console.log('  code has expected SELECT:', requestBody?.code?.includes('SELECT pr.nombre AS nombre_producto, f.total'));
    console.log('  code last 250 chars:');
    console.log(requestBody?.code?.substring(Math.max(0, (requestBody?.code?.length || 0) - 250)));

    const body = await response.json();
    log(`API status: ${response.status()}`, response.status() === 200);
    log(`isCorrect: ${body.isCorrect}`, body.isCorrect === true);
    log(`testsPassed: ${body.testsPassed}/${body.testsTotal}`,
      body.testsPassed === body.testsTotal);
    log(`sandbox error: ${body.sandbox?.error || '(none)'}`,
      !body.sandbox?.error);

    if (body.sandbox?.results?.[0]) {
      const perSol = body.sandbox.results[0];
      log(`solutions[0]: ${perSol.passed}/${perSol.total} fully=${perSol.fullyPassed}`,
        perSol.fullyPassed === true);
    }

    await page.waitForFunction(
      () => document.getElementById('answer-zone')?.querySelector('.is-correct'),
      { timeout: 5000 }
    ).then(() => log('Animación verde apareció', true))
      .catch(() => log('Animación verde NO apareció', false));

    if (errors.length > 0) {
      console.log('\nErrores capturados:');
      errors.forEach((e) => console.log('  ' + e));
      process.exitCode = 1;
    } else {
      log('Sin errores de consola', true);
    }

    await browser.close();

    console.log('\n--- Cleanup BD ---');
    await db.delete(submissions).where(eq(submissions.quizQuestionId, (await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)))[0]?.id ?? 0));
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
    await db.delete(quizzes).where(eq(quizzes.id, quiz.id));
    console.log(`  Quiz ${quiz.id} y dependencias eliminados`);

    await pool.end();
  } catch (err) {
    console.error('Error fatal:', err.message);
    await page.screenshot({ path: 'tests/debug-q65.png', fullPage: true }).catch(() => {});
    await browser.close();
    if (quizId) {
      try {
        const qqIds = await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
        if (qqIds.length > 0) {
          await db.delete(submissions).where(eq(submissions.quizQuestionId, qqIds[0].id));
        }
        await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
        await db.delete(quizzes).where(eq(quizzes.id, quizId));
        console.log(`Cleanup: quiz ${quizId} eliminado en error path`);
      } catch {}
    }
    await pool.end();
    process.exit(1);
  }
}

run();
