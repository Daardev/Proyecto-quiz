const BASE = process.env.TEST_BASE || 'http://localhost:3001';

const log = (msg, ok = true) => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${msg}`);
  if (!ok) process.exitCode = 1;
};

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error(typeof data === 'string' ? data : (data.error || `HTTP ${res.status}`));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function generateQuiz(language = 'javascript', count = 1) {
  return request('/api/quizzes/generate', {
    method: 'POST',
    body: { language, count },
  });
}

async function getCurrentQuestion(quizId, order = null) {
  const qs = order != null ? `?order=${order}` : '';
  return request(`/api/quizzes/${quizId}/current${qs}`);
}

async function previewCode(quizId, questionId, code) {
  return request(`/api/quizzes/${quizId}/preview`, {
    method: 'POST',
    body: { questionId, code },
  });
}

async function finishQuiz(quizId, answers) {
  return request(`/api/quizzes/${quizId}/finish`, {
    method: 'POST',
    body: { answers },
  });
}

async function getResults(quizId) {
  return request(`/api/quizzes/${quizId}/results`);
}

async function getAvailableQuestion(language) {
  const data = await request('/api/languages');
  return data;
}

async function run() {
  console.log('\n=== Tests: Preview limit + Finish flow ===\n');

  console.log('--- Test 1: Generar quiz de 1 pregunta javascript ---');
  let quiz;
  try {
    quiz = await generateQuiz('sql', 1);
    log(`Quiz generado: ${quiz.quizId}`, !!quiz.quizId);
  } catch (err) {
    log(`No se pudo generar quiz: ${err.message}`, false);
    return;
  }

  const current = await getCurrentQuestion(quiz.quizId);
  log(`Pregunta actual: #${current.questionId} (${current.type})`, !!current.questionId);
  log(`previewsUsed inicial: ${current.previewsUsed}`, current.previewsUsed === 0);
  log(`previewsLimit: ${current.previewsLimit}`, current.previewsLimit === 10);

  if (current.type === 'code') {
    console.log('\n--- Test 2: 10 previews OK ---');
    for (let i = 1; i <= 10; i++) {
      try {
        const r = await previewCode(quiz.quizId, current.questionId, '// hi');
        log(`Preview ${i}/10: previewsUsed=${r.previewsUsed}`, r.previewsUsed === i);
      } catch (err) {
        log(`Preview ${i} falló: ${err.message}`, false);
      }
    }

    console.log('\n--- Test 3: 11º preview devuelve 409 ---');
    try {
      await previewCode(quiz.quizId, current.questionId, '// hi');
      log(`11º preview NO debería pasar`, false);
    } catch (err) {
      log(`11º preview devuelve ${err.status} previews_exhausted`, err.status === 409 && /exhausted/.test(err.message));
    }
  }

  console.log('\n--- Test 4: Finish con código correcto ---');
  const answerCode = current.type === 'code' ? 'return 42' : undefined;
  const finishRes = await finishQuiz(quiz.quizId, [{
    order: 1,
    questionId: current.questionId,
    type: current.type,
    code: answerCode,
    skipped: false,
  }]);
  log(`Finish OK: saved=${finishRes.saved}`, finishRes.success === true && finishRes.saved >= 1);

  console.log('\n--- Test 5: Results refleja el finish ---');
  const results = await getResults(quiz.quizId);
  log(`Resultados tienen ${results.questions.length} preguntas`, results.questions.length === 1);
  log(`Pregunta 1 tiene submission`, results.questions[0].submission !== null);

  console.log('\n--- Test 6: Finish en quiz vacío crea skipped ---');
  const quiz2 = await generateQuiz('sql', 1);
  const q2 = await getCurrentQuestion(quiz2.quizId);
  const finish2 = await finishQuiz(quiz2.quizId, [{
    order: 1,
    questionId: q2.questionId,
    type: q2.type,
    skipped: true,
  }]);
  log(`Finish con skipped: saved=${finish2.saved}`, finish2.success === true);
  const r2 = await getResults(quiz2.quizId);
  log(`Submission es kind=skipped`, r2.questions[0].submission?.kind === 'skipped');

  console.log('\n--- Test 7: Finish con preguntas faltantes las marca skipped ---');
  const quiz3 = await generateQuiz('sql', 2);
  const q3a = await getCurrentQuestion(quiz3.quizId, 1);
  const q3b = await getCurrentQuestion(quiz3.quizId, 2);
  // Solo enviamos respuesta para Q1
  const finish3 = await finishQuiz(quiz3.quizId, [{
    order: 1,
    questionId: q3a.questionId,
    type: q3a.type,
    code: 'return 1',
    skipped: false,
  }]);
  log(`Finish respondió 1 de 2: saved=${finish3.saved}`, finish3.success === true && finish3.saved === 2);
  const r3 = await getResults(quiz3.quizId);
  const q3aSub = r3.questions[0].submission;
  const q3bSub = r3.questions[1].submission;
  log(`Q1 fue evaluada`, q3aSub?.kind === 'answer');
  log(`Q2 fue marcada skipped automáticamente`, q3bSub?.kind === 'skipped');

  console.log('\n--- Test 8: ?order=N devuelve la pregunta solicitada ---');
  const quiz4 = await generateQuiz('sql', 3);
  const q4N = await getCurrentQuestion(quiz4.quizId, 2);
  log(`?order=2 devuelve pregunta #${q4N.order}`, q4N.order === 2);

  console.log('\n=== Final ===');
  if (process.exitCode) {
    console.log('FALLARON algunas pruebas');
  } else {
    console.log('TODAS las pruebas PASARON');
  }
}

run().catch(err => {
  console.error('Error fatal:', err.message);
  console.error(err.stack);
  process.exitCode = 1;
});
