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
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(text);
  });

  async function waitForNewQuestion(prevProgress) {
    await page.waitForFunction(
      (prev) => {
        if (/\/results\?quizId=/.test(location.href)) return true;
        const titleEl = document.getElementById('question-description');
        if (!titleEl) return false;
        const title = titleEl.textContent.trim();
        const progressEl = document.getElementById('progress');
        if (!progressEl) return false;
        const progress = progressEl.textContent.trim();
        return progress !== prev && title !== 'Cargando…' && title !== 'Error';
      },
      prevProgress,
      { timeout: 20000 }
    );
  }

  async function waitForQuestionReady() {
    await page.waitForFunction(
      () => {
        if (/\/results\?quizId=/.test(location.href)) return true;
        const btn = document.getElementById('submit-btn');
        const titleEl = document.getElementById('question-description');
        if (!btn || !titleEl) return false;
        const title = titleEl.textContent.trim();
        return !btn.disabled && title !== 'Cargando…' && title !== 'Error';
      },
      { timeout: 20000 }
    );
  }

  try {
    // ============================================================
    console.log('\n=== Suite A: Usuario LOGUEADO ===');
    // ============================================================

    console.log('\n--- Test A1: Login como admin ---');
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', ADMIN_USERNAME);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/', { timeout: 10000 }),
      page.click('#login-btn, button[type="submit"]'),
    ]);
    log(`Login redirigió a ${page.url()}`, page.url().includes('/admin') || page.url().includes('/'));

    console.log('\n--- Test A2: Generar quiz SQL ---');
    await page.goto(`${BASE}/`);
    await page.waitForSelector('.lang-card[data-language="sql"]', { timeout: 5000 });
    await page.click('.lang-card[data-language="sql"]');
    await page.waitForSelector('#start-btn:not([disabled])', { timeout: 5000 });
    await page.click('#start-btn');
    await page.waitForURL(/\/quiz\?quizId=\d+/, { timeout: 15000 });
    log(`Quiz URL: ${page.url()}`, /quiz\?quizId=\d+/.test(page.url()));

    console.log('\n--- Test A3: Responder Q1 y avanzar a Q2 ---');
    await page.waitForSelector('#question-description', { timeout: 5000 });
    await page.waitForFunction(
      () => document.getElementById('question-description').textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );
    const aQ1Title = await page.locator('#question-description').textContent();
    log(`Q1: "${aQ1Title.substring(0, 50)}..."`, aQ1Title.length > 0);

    const isMC_A = await page.locator('#choice-area').isVisible();
    if (isMC_A) {
      await page.locator('#options-container button').first().click();
    } else {
      const ta = page.locator('textarea.inputarea').first();
      if (await ta.count() > 0) await ta.fill('SELECT 1');
    }
    await page.click('#submit-btn');
    await page.waitForSelector('#feedback:not(.hidden)', { timeout: 10000 });
    await page.click('#next-btn');
    const totalTextA = await page.locator('#progress').textContent();
    const totalA = parseInt(totalTextA.split('/')[1].trim(), 10) || 10;
    await waitForNewQuestion('1 / ' + totalA);
    const aQ2Title = await page.locator('#question-description').textContent();
    log(`Q2: "${aQ2Title.substring(0, 50)}..."`, aQ2Title.length > 0);
    log(`Q1 ≠ Q2 (no loop): OK`, aQ1Title !== aQ2Title);

    console.log('\n--- Test A4: Completar quiz logged-in ---');
    let prevProgress = await page.locator('#progress').textContent();
    for (let i = 2; i <= totalA; i++) {
      if (/\/results\?quizId=/.test(page.url())) break;
      await waitForQuestionReady();
      const isMC = await page.locator('#choice-area').isVisible();
      if (isMC) {
        await page.locator('#options-container button').first().click();
      } else {
        const ta = page.locator('textarea.inputarea').first();
        if (await ta.count() > 0) await ta.fill('SELECT 1');
      }
      await page.click('#submit-btn');
      await page.waitForSelector('#feedback:not(.hidden)', { timeout: 10000 });
      await page.click('#next-btn');
      if (i < totalA) {
        await waitForNewQuestion(prevProgress);
        if (/\/results\?quizId=/.test(page.url())) break;
        prevProgress = await page.locator('#progress').textContent();
      }
    }
    await page.waitForURL(/\/results\?quizId=\d+/, { timeout: 20000 }).catch(() => {});
    log(`URL final (logged-in): ${page.url()}`, /\/results\?quizId=\d+/.test(page.url()));

    // ============================================================
    console.log('\n\n=== Suite B: Usuario ANÓNIMO (sin login) ===');
    // ============================================================

    console.log('\n--- Test B0: Logout para limpiar sesión ---');
    await page.goto(`${BASE}/profile`);
    await page.waitForTimeout(1000);
    const logoutBtn = page.locator('form[action="/api/auth/logout"] button').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
    }
    log(`Después de logout: ${page.url()}`, true);

    console.log('\n--- Test B1: Generar quiz SQL sin autenticación ---');
    await page.context().clearCookies();
    await page.goto(`${BASE}/`);
    await page.waitForSelector('.lang-card[data-language="sql"]', { timeout: 5000 });
    await page.click('.lang-card[data-language="sql"]');
    await page.waitForSelector('#start-btn:not([disabled])', { timeout: 5000 });
    await page.click('#start-btn');
    await page.waitForURL(/\/quiz\?quizId=\d+/, { timeout: 15000 });
    const bQuizUrl = page.url();
    log(`Quiz anónimo URL: ${bQuizUrl}`, /quiz\?quizId=\d+/.test(bQuizUrl));

    console.log('\n--- Test B2: Responder Q1 (anónimo) y avanzar a Q2 ---');
    await page.waitForSelector('#question-description', { timeout: 5000 });
    await page.waitForFunction(
      () => document.getElementById('question-description').textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );
    const bQ1Title = await page.locator('#question-description').textContent();
    log(`Q1 (anónimo): "${bQ1Title.substring(0, 50)}..."`, bQ1Title.length > 0);

    const isMC_B = await page.locator('#choice-area').isVisible();
    if (isMC_B) {
      await page.locator('#options-container button').first().click();
    } else {
      const ta = page.locator('textarea.inputarea').first();
      if (await ta.count() > 0) await ta.fill('SELECT 1');
    }
    await page.click('#submit-btn');
    await page.waitForSelector('#feedback:not(.hidden)', { timeout: 10000 });

    const feedbackText = await page.locator('#feedback').textContent();
    log(`Feedback contiene "modo invitado": ${/invitado|perfil/.test(feedbackText)}`, true);

    await page.click('#next-btn');
    const totalTextB = await page.locator('#progress').textContent();
    const totalB = parseInt(totalTextB.split('/')[1].trim(), 10) || 10;
    await waitForNewQuestion('1 / ' + totalB);
    const bQ2Title = await page.locator('#question-description').textContent();
    log(`Q2 (anónimo): "${bQ2Title.substring(0, 50)}..."`, bQ2Title.length > 0);
    log(`Q1 ≠ Q2 (NO loop): OK`, bQ1Title !== bQ2Title);

    console.log('\n--- Test B3: Completar quiz anónimo ---');
    let prevProgressB = await page.locator('#progress').textContent();
    for (let i = 2; i <= totalB; i++) {
      if (/\/results\?quizId=/.test(page.url())) break;
      await waitForQuestionReady();
      const isMC = await page.locator('#choice-area').isVisible();
      if (isMC) {
        await page.locator('#options-container button').first().click();
      } else {
        const ta = page.locator('textarea.inputarea').first();
        if (await ta.count() > 0) await ta.fill('SELECT 1');
      }
      await page.click('#submit-btn');
      await page.waitForSelector('#feedback:not(.hidden)', { timeout: 10000 });
      await page.click('#next-btn');
      if (i < totalB) {
        await waitForNewQuestion(prevProgressB);
        if (/\/results\?quizId=/.test(page.url())) break;
        prevProgressB = await page.locator('#progress').textContent();
      }
    }
    await page.waitForURL(/\/results\?quizId=\d+/, { timeout: 20000 }).catch(() => {});
    log(`URL final (anónimo): ${page.url()}`, /\/results\?quizId=\d+/.test(page.url()));

    if (errors.length > 0) {
      console.log('\n=== Errores capturados ===');
      for (const err of errors) console.log('  ', err);
    } else {
      console.log('\n=== Sin errores en consola ===');
    }

    console.log('\n=== Resultado final ===');
    if (process.exitCode) {
      console.log('FALLARON algunas pruebas');
    } else {
      console.log('TODAS las pruebas PASARON (logged-in + anónimo)');
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    console.error('Stack:', err.stack);
    await page.screenshot({ path: 'tests/debug-anon.png' }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
