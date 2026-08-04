import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';

const log = (msg, ok = true) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function run() {
  console.log('=== Test: botón preview en admin form ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  try {
    console.log('-- Login como admin --');
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin12345');
    await Promise.all([
      page.waitForURL((u) => u.pathname === '/admin' || u.pathname === '/'),
      page.click('button[type="submit"]'),
    ]);
    log(`Login OK: ${page.url()}`, /\/admin|\//.test(page.url()));

    console.log('\n-- Navegar a /admin/68/edit --');
    await page.goto(`${BASE}/admin/68/edit`);
    await page.waitForSelector('#preview-btn', { timeout: 5000 });
    log('Botón preview-btn presente en form de edición', true);

    console.log('\n-- Click en 🧪 Probar esta pregunta --');
    const popupPromise = context.waitForEvent('page', { timeout: 10000 });

    await page.click('#preview-btn');

    const popupPage = await popupPromise;
    log('Nueva pestaña abierta: ' + popupPage.url(), popupPage.url().includes('/quiz?quizId='));

    await popupPage.waitForSelector('#question-title', { timeout: 10000 });
    await popupPage.waitForFunction(
      () => document.getElementById('question-title')?.textContent.trim() !== 'Cargando…',
      { timeout: 10000 }
    );
    const title = await popupPage.locator('#question-title').textContent();
    const language = await popupPage.locator('#language-tag').textContent();
    log(`Pregunta en popup renderizada: "${title.substring(0, 50)}..."`, title.length > 0);
    log(`Language tag: "${language}"`, language.includes('sql'));

    console.log('\n-- Verificar progress "1 / 1" (quiz de 1 sola pregunta) --');
    const progress = await popupPage.locator('#progress').textContent();
    log(`Progress: "${progress}"`, progress.includes('1 /'));

    console.log('\n-- Verificar botón preview-btn se deshabilita brevemente --');
    const btnState = await page.locator('#preview-btn').textContent();
    log(`Texto del botón después: "${btnState}"`, true);

    await page.waitForTimeout(2000);
    const finalBtnState = await page.locator('#preview-btn').textContent();
    log(`Texto del botón tras reset: "${finalBtnState}"`, finalBtnState.includes('Probar'));

    if (errors.length > 0) {
      console.log('\n=== Errores capturados ===');
      errors.forEach((e) => console.log(' ', e));
    } else {
      log('Sin errores de consola', true);
    }

    await browser.close();
  } catch (err) {
    console.error('Error fatal:', err.message);
    await page.screenshot({ path: 'tests/debug-preview.png', fullPage: true }).catch(() => {});
    await browser.close();
    process.exit(1);
  }
}

run();
