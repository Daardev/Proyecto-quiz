import { chromium } from 'playwright';
import { pool } from '../src/config/database.js';

const BASE = 'http://localhost:3001';

async function dbAttemptsLeft(quizId) {
  const r = await pool.query(`SELECT attempts_left FROM quizzes WHERE id = $1`, [quizId]);
  return r.rows[0]?.attempts_left;
}

async function dbAttemptsCount(quizId, order) {
  const r = await pool.query(
    `SELECT attempts_count FROM quiz_questions WHERE quiz_id = $1 AND "order" = $2`,
    [quizId, order]
  );
  return r.rows[0]?.attempts_count;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`PAGE ERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`CONSOLE ERROR: ${msg.text()}`);
  });

  const log = (msg, ok = true) => {
    const icon = ok ? '✓' : '✗';
    console.log(`${icon} ${msg}`);
    if (!ok) process.exitCode = 1;
  };

  let exitCode = 0;
  const check = (msg, cond) => {
    log(msg, cond);
    if (!cond) exitCode = 1;
  };

  const heartsLostUI = async () => page.$$eval('.heart.lost', els => els.length);

  const waitForSubmitResponse = (quizId) => {
    return page.waitForResponse(
      r => r.url().includes(`/api/quizzes/${quizId}/submit`) && r.request().method() === 'POST',
      { timeout: 10000 }
    );
  };

  try {
    log('1. Generar quiz SQL (count=all)');
    await page.goto(`${BASE}/`);
    await page.click('.lang-card[data-language="sql"]');
    await page.waitForSelector('#start-btn:not([disabled])', { timeout: 5000 });
    await page.click('#start-btn');
    await page.waitForURL(/\/quiz\?quizId=\d+/, { timeout: 15000 });
    const m = page.url().match(/quizId=(\d+)/);
    const quizId = parseInt(m[1], 10);
    log(`   quizId = ${quizId}`);

    check('   DB attempts_left inicial = 5', (await dbAttemptsLeft(quizId)) === 5);

    await page.waitForSelector('#question-card');
    await page.waitForFunction(
      () => {
        const t = document.getElementById('question-title')?.textContent.trim();
        return t && t !== 'Cargando…';
      },
      { timeout: 10000 }
    );

    // ============================================================
    // PARTE A: estado inicial — sin feedback card, sin skip, sin is-failed
    // ============================================================
    log('2. Estado inicial limpio');
    const titleA = (await page.locator('#question-title').textContent()).trim();
    check('   Hay título de pregunta', titleA.length > 0 && titleA !== 'Cargando…');
    check('   Sin animación de feedback al inicio', (await page.locator('.answer-feedback').count()) === 0);
    check('   NO existe botón Saltar', (await page.locator('#skip-btn').count()) === 0);
    check('   Sin clase is-failed al inicio',
      !(await page.locator('#question-card').evaluate(el => el.classList.contains('is-failed'))));

    const isMC = await page.locator('#choice-area').isVisible();

    // ============================================================
    // PARTE B: enviar respuesta incorrecta → animación de error + -1 vida
    // ============================================================
    log('3. Enviar respuesta INCORRECTA en Q1');

    if (isMC) {
      // pickear la PRIMERA opción que sea incorrecta. Si la primera es correcta, vamos directo al final del flujo "todo correcto".
      const r1 = await pool.query(
        "SELECT correct_option FROM questions WHERE language='sql' AND type='multiple_choice' AND is_active=true LIMIT 1"
      );
      // no podemos saber el correct_option hasta que cargue Q1. Iteramos.
      const optCount = await page.locator('#options-container button').count();
      let wrongOptIdx = -1;
      for (let i = 0; i < optCount; i++) {
        await page.locator('#options-container button').nth(i).click();
        const [resp] = await Promise.all([
          waitForSubmitResponse(quizId),
          page.click('#submit-btn'),
        ]);
        const body = await resp.json().catch(() => ({}));
        const correct = body.isCorrect === true
          || (body.testsTotal > 0 && body.testsPassed === body.testsTotal);
        if (correct) {
          // primera opción correcta — esperá auto-avance
          await page.waitForSelector('.answer-feedback.is-correct', { timeout: 5000 });
          const progBefore = await page.locator('#progress').textContent();
          await page.waitForFunction(
            (prev) => {
              const prog = document.getElementById('progress')?.textContent.trim();
              const fb = document.querySelector('.answer-feedback');
              return fb === null && prog !== prev;
            },
            progBefore,
            { timeout: 10000 }
          );
          log('   Primera opción fue correcta; Q1 saltada limpia');
          // Verificar
          check('   DB: attempts_left = 5 (no se gastó vida en Q1)', (await dbAttemptsLeft(quizId)) === 5);
          check('   NO hay clase is-failed en Q2',
            !(await page.locator('#question-card').evaluate(el => el.classList.contains('is-failed'))));
          await testQ2Direct(quizId);
          return;
        }
        wrongOptIdx = i;
        break;
      }

      // wrongOptIdx encontrado
      await page.waitForSelector('.answer-feedback.is-error', { timeout: 5000 });
      check('   UI: animación de error visible',
        (await page.locator('.answer-feedback.is-error').count()) > 0);
      check('   NO existe botón Saltar', (await page.locator('#skip-btn').count()) === 0);
      check('   Sin clase is-failed en .question-card',
        !(await page.locator('#question-card').evaluate(el => el.classList.contains('is-failed'))));
      check('   DB: attempts_left = 4', (await dbAttemptsLeft(quizId)) === 4);
      check('   UI: 1 corazón perdido', (await heartsLostUI()) === 1);
      check('   Opción incorrecta tiene clase .is-incorrect',
        await page.locator(`#options-container button[data-idx="${wrongOptIdx}"]`)
          .evaluate(el => el.classList.contains('is-incorrect')));

      // esperar a que termine la animación y se restaure el botón
      await page.waitForFunction(
        () => document.querySelector('.answer-feedback') === null,
        { timeout: 5000 }
      );

      // Cambiar a OTRA opción y verificar que la incorrecta MANTIENE su marca roja
      log('4a. Cambiar a otra opción → la incorrecta mantiene .is-incorrect');
      const otherIdx = wrongOptIdx === 0 ? 1 : 0;
      await page.locator(`#options-container button[data-idx="${otherIdx}"]`).click();
      check('   Nueva opción tiene clase .is-selected',
        await page.locator(`#options-container button[data-idx="${otherIdx}"]`)
          .evaluate(el => el.classList.contains('is-selected')));
      check('   La opción incorrecta anterior MANTIENE .is-incorrect',
        await page.locator(`#options-container button[data-idx="${wrongOptIdx}"]`)
          .evaluate(el => el.classList.contains('is-incorrect')));
      check('   La opción incorrecta anterior NO tiene .is-selected',
        !(await page.locator(`#options-container button[data-idx="${wrongOptIdx}"]`)
          .evaluate(el => el.classList.contains('is-selected'))));

      // Reenviar la OTRA opción (puede ser incorrecta o correcta según la pregunta)
      log('4b. Reenviar la nueva opción → puede ser incorrecta o correcta');
      const [resp2] = await Promise.all([
        waitForSubmitResponse(quizId),
        page.click('#submit-btn'),
      ]);
      const body2 = await resp2.json().catch(() => ({}));
      const secondCorrect = body2.isCorrect === true
        || (body2.testsTotal > 0 && body2.testsPassed === body2.testsTotal);

      if (secondCorrect) {
        log('   La nueva opción resultó CORRECTA → auto-avance a Q2');
        await page.waitForSelector('.answer-feedback.is-correct', { timeout: 5000 });
        check('   UI: animación de check visible',
          (await page.locator('.answer-feedback.is-correct').count()) > 0);
        await page.waitForFunction(
          () => document.querySelector('.answer-feedback') === null,
          { timeout: 5000 }
        );
        check('   DB: attempts_left NO cambió tras segundo acierto',
          (await dbAttemptsLeft(quizId)) === 4);
      } else {
        await page.waitForSelector('.answer-feedback.is-error', { timeout: 5000 });
        check('   DB: attempts_left = 3', (await dbAttemptsLeft(quizId)) === 3);
        check('   UI: 2 corazones perdidos', (await heartsLostUI()) === 2);
        check('   DB: attempts_count de Q1 = 2', (await dbAttemptsCount(quizId, 1)) === 2);

        const incorrectCount = await page.locator('#options-container button.option-btn.is-incorrect').count();
        check(`   ${incorrectCount} opciones con .is-incorrect (acumulación)`, incorrectCount >= 1);

        await page.waitForFunction(
          () => document.querySelector('.answer-feedback') === null,
          { timeout: 5000 }
        );
      }
    } else {
      // code
      log('   pregunta tipo CODE');
      await page.evaluate(() => {
        const editors = window.monaco?.editor?.getEditors?.() || [];
        const editor = editors[editors.length - 1];
        if (editor) editor.setValue('SELECT __bad_xyz__');
      });
      await Promise.all([
        waitForSubmitResponse(quizId),
        page.click('#submit-btn'),
      ]);

      await page.waitForSelector('.answer-feedback.is-error', { timeout: 5000 });
      check('   UI: animación de error visible',
        (await page.locator('.answer-feedback.is-error').count()) > 0);
      check('   DB: attempts_left = 4', (await dbAttemptsLeft(quizId)) === 4);
      check('   UI: 1 corazón perdido', (await heartsLostUI()) === 1);

      await page.waitForFunction(
        () => document.querySelector('.answer-feedback') === null,
        { timeout: 5000 }
      );

      log('4. Reenviar SEGUNDA respuesta incorrecta en Q1 (code)');
      await page.evaluate(() => {
        const editors = window.monaco?.editor?.getEditors?.() || [];
        const editor = editors[editors.length - 1];
        if (editor) editor.setValue('SELECT __otra_mala_abc__');
      });
      check('   submit-btn habilitado tras error',
        await page.locator('#submit-btn').isEnabled());
      await Promise.all([
        waitForSubmitResponse(quizId),
        page.click('#submit-btn'),
      ]);

      await page.waitForSelector('.answer-feedback.is-error', { timeout: 5000 });
      check('   DB: attempts_left = 3', (await dbAttemptsLeft(quizId)) === 3);
      check('   UI: 2 corazones perdidos', (await heartsLostUI()) === 2);
      check('   DB: attempts_count de Q1 = 2', (await dbAttemptsCount(quizId, 1)) === 2);

      await page.waitForFunction(
        () => document.querySelector('.answer-feedback') === null,
        { timeout: 5000 }
      );
    }

    // ============================================================
    // PARTE C: recargar después de fallos → corazones persisten
    // ============================================================
    log('5. REFRESH después de fallos → corazones persisten');
    const livesBeforeReload = await dbAttemptsLeft(quizId);
    const lostBeforeReload = await heartsLostUI();
    await page.reload();
    await page.waitForSelector('#question-card', { timeout: 10000 });
    await page.waitForFunction(
      () => {
        const t = document.getElementById('question-title')?.textContent.trim();
        return t && t !== 'Cargando…';
      },
      { timeout: 10000 }
    );
    const lostAfterReload = await heartsLostUI();
    const dbAfterReload = await dbAttemptsLeft(quizId);
    check(`   UI hearts lost = ${lostAfterReload} (esperado ${lostBeforeReload})`,
      lostAfterReload === lostBeforeReload);
    check(`   DB attempts_left = ${dbAfterReload} (esperado ${livesBeforeReload})`,
      dbAfterReload === livesBeforeReload);
    check('   Sin clase is-failed tras reload',
      !(await page.locator('#question-card').evaluate(el => el.classList.contains('is-failed'))));
    check('   NO existe botón Saltar tras reload', (await page.locator('#skip-btn').count()) === 0);
    const incorrectAfterReload = await page.locator('#options-container button.option-btn.is-incorrect').count();
    check(`   Opciones con .is-incorrect tras reload = ${incorrectAfterReload} (esperado 0)`,
      incorrectAfterReload === 0);

    log('\n=== RESULTADO ===');
    if (pageErrors.length === 0) {
      log('Sin errores en consola del navegador');
    } else {
      log(`Errores en consola:\n${pageErrors.join('\n')}`, false);
    }
    log(exitCode === 0 ? 'Flujo sin feedback intermedio: OK ✓' : 'Flujo sin feedback intermedio: FALLÓ ✗', exitCode === 0);

    // helper: cuando la primera opción es correcta (sin error de prueba), vamos a Q2
    async function testQ2Direct(quizId) {
      // En este branch ya estamos en Q2. Verificamos que NO haya feedback.
      check('   Sin animación de feedback al inicio de Q2',
        (await page.locator('.answer-feedback').count()) === 0);
      check('   Q2 NO tiene clase is-failed',
        !(await page.locator('#question-card').evaluate(el => el.classList.contains('is-failed'))));

      log('4. (skip) → ir a PARTE 5');

      // ============================================================
      // PARTE 5: REFRESH después de Q1 contestada → todo en orden
      // ============================================================
      log('5. REFRESH → Q2 persiste');
      const livesBeforeReload = await dbAttemptsLeft(quizId);
      await page.reload();
      await page.waitForSelector('#question-card', { timeout: 10000 });
      await page.waitForFunction(
        () => {
          const t = document.getElementById('question-title')?.textContent.trim();
          return t && t !== 'Cargando…';
        },
        { timeout: 10000 }
      );
      const dbAfterReload = await dbAttemptsLeft(quizId);
      check(`   DB attempts_left = ${dbAfterReload} (esperado ${livesBeforeReload})`,
        dbAfterReload === livesBeforeReload);
      check('   NO existe botón Saltar tras reload', (await page.locator('#skip-btn').count()) === 0);

      log('\n=== RESULTADO ===');
      if (pageErrors.length === 0) {
        log('Sin errores en consola del navegador');
      } else {
        log(`Errores en consola:\n${pageErrors.join('\n')}`, false);
      }
      log(exitCode === 0 ? 'Flujo sin feedback intermedio: OK ✓' : 'Flujo sin feedback intermedio: FALLÓ ✗', exitCode === 0);
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    console.error('Stack:', err.stack);
    exitCode = 1;
  } finally {
    await pool.end();
    await browser.close();
    process.exit(exitCode);
  }
})();