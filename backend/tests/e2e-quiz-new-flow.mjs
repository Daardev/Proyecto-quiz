import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || (process.env.NODE_ENV === 'production' ? null : 'admin');
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin12345');

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error('E2E_ADMIN_USERNAME y E2E_ADMIN_PASSWORD son requeridos cuando NODE_ENV=production');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const log = (msg, ok = true) => {
    const icon = ok ? '✓' : '✗';
    console.log(`${icon} ${msg}`);
    if (!ok) process.exitCode = 1;
  };

  const errors = [];
  page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`));
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error') errors.push(text);
  });

  async function fillCodeEditor(value) {
    await page.evaluate((v) => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      const editor = editors[editors.length - 1];
      if (editor) editor.setValue(v);
    }, value);
  }

  async function waitForQuestionReady() {
    await page.waitForFunction(
      () => {
        if (/\/results\?quizId=/.test(location.href)) return true;
        const titleEl = document.getElementById('question-title');
        const panelList = document.getElementById('quiz-panel-list');
        if (!titleEl || !panelList) return false;
        const title = titleEl.textContent.trim();
        return title !== 'Cargando…' && title !== 'Error' && panelList.children.length > 0;
      },
      { timeout: 20000 }
    );
  }

  async function clearLocalStorage() {
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
  }

  try {
    console.log('\n=== Test: Flujo completo del quiz (sin vidas, eval al final) ===\n');

    console.log('--- Login como admin ---');
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', ADMIN_USERNAME);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    log(`Login OK: ${page.url()}`, !page.url().includes('/login'));

    console.log('\n--- Generar quiz SQL ---');
    await page.goto(`${BASE}/`);
    await page.waitForSelector('.lang-card[data-language="sql"]', { timeout: 5000 });
    await page.click('.lang-card[data-language="sql"]');
    await page.waitForSelector('#start-btn:not([disabled])', { timeout: 5000 });
    await page.click('#start-btn');
    await page.waitForURL(/\/quiz\?quizId=\d+/, { timeout: 15000 });
    log(`Quiz URL: ${page.url()}`, /quiz\?quizId=\d+/.test(page.url()));

    await waitForQuestionReady();
    await clearLocalStorage();

    const totalText = await page.locator('#progress').textContent();
    const total = parseInt(totalText.split('/')[1].trim(), 10) || 5;
    log(`Total de preguntas: ${total}`, total > 0);

    console.log('\n--- Verificar panel lateral ---');
    const panelItems = await page.locator('#quiz-panel-list .quiz-panel__item').count();
    log(`Panel muestra ${panelItems} items`, panelItems === total);

    console.log('\n--- Responder cada pregunta ---');
    for (let i = 1; i <= total; i++) {
      if (/\/results\?quizId=/.test(page.url())) break;

      const panelItem = page.locator(`#quiz-panel-list .quiz-panel__item[data-order="${i}"]`);
      if (await panelItem.count() === 0) break;
      await panelItem.click();
      await waitForQuestionReady();

      const isMC = await page.locator('#choice-area').isVisible();
      if (isMC) {
        await page.locator('#options-container button').first().click();
        log(`Q${i}: opción múltiple seleccionada`, true);
      } else {
        await fillCodeEditor('SELECT 1');
        log(`Q${i}: código escrito`, true);
      }
      const previewBtnExists = await page.locator('#preview-btn').count();
      if (previewBtnExists > 0) {
        const previewText = await page.locator('#preview-btn').textContent();
        log(`Q${i}: "Probar código" muestra "${previewText.trim()}"`, /\(\d+\/10\)/.test(previewText));
      }
    }

    console.log('\n--- Verificar botón Terminar Quiz en la última ---');
    const finishBtn = page.locator('#finish-btn');
    const finishVisible = await finishBtn.isVisible();
    log(`Botón "Terminar Quiz" visible en la última pendiente`, finishVisible);

    console.log('\n--- Click en Terminar Quiz ---');
    await page.click('#finish-btn');
    await page.waitForURL(/\/results\?quizId=\d+/, { timeout: 20000 }).catch(() => {});
    log(`Redirigido a /results: ${page.url()}`, /\/results\?quizId=\d+/.test(page.url()));

    console.log('\n--- Verificar resultados ---');
    await page.waitForSelector('#questions-list', { timeout: 10000 }).catch(() => {});
    const feedbackCards = await page.locator('.feedback-card').count();
    log(`Tarjetas de feedback: ${feedbackCards}`, feedbackCards > 0);

    if (errors.length > 0) {
      console.log('\n=== Errores en consola ===');
      for (const err of errors) console.log('  ', err);
    } else {
      console.log('\n=== Sin errores en consola ===');
    }

    console.log('\n=== Resultado final ===');
    if (process.exitCode) {
      console.log('FALLARON algunas pruebas');
    } else {
      console.log('TODAS las pruebas PASARON');
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    console.error('Stack:', err.stack);
    await page.screenshot({ path: 'tests/debug-new-flow.png' }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
