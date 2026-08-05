import { chromium } from 'playwright';
import { db, pool } from '../src/config/database.js';
import { sql, eq } from 'drizzle-orm';
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
  console.log('=== E2E: pregunta id=68 vía UI flow (controller → runAgainstSolutions) ===\n');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  try {
    const quizId = await createPreviewQuiz(68, 'sql');
    console.log(`  quizId creado: ${quizId}`);

    await page.goto(`${BASE}/quiz?quizId=${quizId}`);
    await page.waitForSelector('#question-title', { timeout: 10000 });
    await page.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );
    const title = await page.locator('#question-title').textContent();
    log(`Pregunta cargada: "${title.substring(0, 50)}..."`, title.length > 0);

    const viewerCount = await page.evaluate(() => window.monaco?.editor?.getEditors?.()?.length || 0);
    log(`Monaco editors instanciados (viewer read-only + editor editable): ${viewerCount}`, viewerCount >= 2);

    await page.evaluate(() => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      const editor = editors[editors.length - 1];
      if (editor) editor.setValue('DELETE FROM Pedidos WHERE EXTRACT(YEAR FROM fecha) < 2023;');
    });
    log('Tu respuesta escrita en el editor', true);

    await page.click('#submit-btn');
    console.log('  Submit clickeado, esperando respuesta...');

    const response = await page.waitForResponse(
      (r) => r.url().includes(`/api/quizzes/${quizId}/submit`),
      { timeout: 15000 }
    );
    const body = await response.json();
    console.log(`  API status: ${response.status()}`);
    console.log(`  isCorrect: ${body.isCorrect}`);
    console.log(`  testsPassed: ${body.testsPassed}/${body.testsTotal}`);
    if (body.sandbox) {
      console.log(`  sandbox error: ${body.sandbox.error || '(ninguno)'}`);
      console.log(`  sandbox perSolution: ${JSON.stringify(body.sandbox.results?.[0] || body.sandbox)}`);
    }

    log(`Respuesta del servidor: isCorrect=true`, body.isCorrect === true);

    await page.waitForFunction(
      () => {
        const z = document.getElementById('answer-zone');
        return z?.querySelector('.is-correct');
      },
      { timeout: 5000 }
    ).then(() => console.log('  ✓ Animación verde apareció')).catch(() => console.log('  ✗ No apareció animación correcta'));

    await browser.close();
    await pool.end();
  } catch (err) {
    console.error('Error fatal:', err.message);
    await page.screenshot({ path: 'tests/debug-q68-ui.png', fullPage: true }).catch(() => {});
    await browser.close();
    await pool.end();
    process.exit(1);
  }
}

run();
