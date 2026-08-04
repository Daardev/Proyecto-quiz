import { eq, and, sql } from 'drizzle-orm';
import { db, pool } from '../config/database.js';
import { quizzes, quizQuestions, submissions, questions } from '../drizzle/schema.js';
import { executeCodeInSandbox, evaluateMultipleChoice, evaluateMarkup, runAgainstSolutions } from '../services/sandbox.service.js';

function detectCategoryFromTechnology(techName) {
  const n = techName.toLowerCase();
  if (n.includes('node')) return 'node';
  if (n.includes('postgres') || n.includes('sql')) return 'postgresql';
  return 'javascript';
}

const MAX_ATTEMPTS = 5;

async function decrementAttempts(quizId) {
  const r = await pool.query(
    `UPDATE quizzes
        SET attempts_left = GREATEST(attempts_left - 1, 0)
      WHERE id = $1 AND attempts_left > 0
      RETURNING attempts_left`,
    [quizId]
  );
  return r.rows[0]?.attempts_left ?? 0;
}

async function getAttemptsLeft(quizId) {
  const r = await pool.query(
    `SELECT attempts_left FROM quizzes WHERE id = $1`,
    [quizId]
  );
  return r.rows[0]?.attempts_left ?? 0;
}

async function incrementQuestionAttempts(quizQuestionId) {
  await pool.query(
    `UPDATE quiz_questions
        SET attempts_count = attempts_count + 1
      WHERE id = $1`,
    [quizQuestionId]
  );
}

async function getQuestionAttemptsCount(quizQuestionId) {
  const r = await pool.query(
    `SELECT attempts_count FROM quiz_questions WHERE id = $1`,
    [quizQuestionId]
  );
  return r.rows[0]?.attempts_count ?? 0;
}

function isSubmissionCorrect(sandboxResult) {
  if (sandboxResult?._isCorrect === true) return true;
  return sandboxResult?.success === true
    && (sandboxResult?.total || 0) > 0
    && (sandboxResult?.passed || 0) === (sandboxResult?.total || 0);
}

export async function submitAnswer(req, res) {
  const quizId = parseInt(req.params.quizId, 10);
  const { questionId, code, answer } = req.body || {};

  if (!Number.isInteger(quizId) || !questionId) {
    return res.status(400).json({ error: 'quizId y questionId son requeridos' });
  }

  const qqRows = await db.select().from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)))
    .limit(1);

  if (qqRows.length === 0) {
    return res.status(404).json({ error: 'pregunta no encontrada en este quiz' });
  }
  const qq = qqRows[0];

  const qRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (qRows.length === 0) {
    return res.status(404).json({ error: 'pregunta no existe' });
  }
  const question = qRows[0];

  const attemptsLeft = await getAttemptsLeft(quizId);
  if (attemptsLeft <= 0) {
    return res.status(400).json({ error: 'sin intentos restantes' });
  }

  let sandboxResult;
  let userCode = '';
  if (question.type === 'multiple_choice') {
    if (answer === undefined || answer === null) {
      return res.status(400).json({ error: 'answer (índice de opción) es requerido' });
    }
    sandboxResult = evaluateMultipleChoice(answer, question.correctOption);
    userCode = JSON.stringify({ answer });
  } else {
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'code es requerido para preguntas de código' });
    }
    const language = (question.language || '').toLowerCase();

    if (Array.isArray(question.solutions) && question.solutions.length > 0) {
      sandboxResult = await runAgainstSolutions(code, language, question.solutions, question.setupCode);
    } else {
      const category = language === 'sql' ? 'postgresql' : language;
      const tests = question.testsTemplate || [];
      if (language === 'html-css-js') {
        sandboxResult = evaluateMarkup(code, tests);
      } else {
        sandboxResult = await executeCodeInSandbox(code, category, tests, question.setupCode);
      }
    }
    userCode = code;
  }

  const isCorrect = isSubmissionCorrect(sandboxResult);
  const score = isCorrect
    ? (sandboxResult?._isCorrect === true
        ? 100
        : Math.round(((sandboxResult.passed || 0) / (sandboxResult.total || 1)) * 100))
    : 0;

  // Stamp isCorrect within sandboxResults so the frontend can read a reliable flag
  // (avoids the 0===0 bug for MC questions where testsTotal is 0).
  const sandboxWithFlag = { ...sandboxResult, _isCorrect: isCorrect };

  let newAttemptsLeft = attemptsLeft;
  if (!isCorrect) {
    newAttemptsLeft = await decrementAttempts(quizId);
  }

  const existingSub = await db.select().from(submissions).where(eq(submissions.quizQuestionId, qq.id)).limit(1);

  let submission;
  if (existingSub.length > 0) {
    const [updated] = await db.update(submissions)
      .set({
        code: userCode,
        sandboxResults: sandboxWithFlag,
        score,
        evaluatedAt: new Date(),
        kind: 'answer',
      })
      .where(eq(submissions.id, existingSub[0].id))
      .returning();
    submission = updated;
  } else {
    const [inserted] = await db.insert(submissions).values({
      quizQuestionId: qq.id,
      code: userCode,
      sandboxResults: sandboxWithFlag,
      score,
      evaluatedAt: new Date(),
      kind: 'answer',
    }).returning();
    submission = inserted;
  }

  await incrementQuestionAttempts(qq.id);
  const attemptsCount = await getQuestionAttemptsCount(qq.id);

  return res.json({
    submissionId: submission.id,
    saved: true,
    isCorrect,
    score,
    testsPassed: sandboxResult.passed || 0,
    testsTotal: sandboxResult.total || 0,
    sandbox: sandboxWithFlag,
    notLoggedIn: !req.user,
    message: req.user ? null : 'Inicia sesión para acumular puntos en tu perfil',
    attemptsLeft: newAttemptsLeft,
    maxAttempts: MAX_ATTEMPTS,
    attemptsCount,
  });
}

export async function skipQuestion(req, res) {
  const quizId = parseInt(req.params.quizId, 10);
  const { questionId } = req.body || {};

  if (!Number.isInteger(quizId) || !questionId) {
    return res.status(400).json({ error: 'quizId y questionId son requeridos' });
  }

  const qqRows = await db.select().from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)))
    .limit(1);

  if (qqRows.length === 0) {
    return res.status(404).json({ error: 'pregunta no encontrada en este quiz' });
  }
  const qq = qqRows[0];

  const existingSub = await db.select().from(submissions).where(eq(submissions.quizQuestionId, qq.id)).limit(1);
  if (existingSub.length > 0) {
    const lastCorrect = isSubmissionCorrect(existingSub[0].sandboxResults);
    if (lastCorrect) {
      return res.status(409).json({ error: 'esta pregunta ya fue respondida correctamente' });
    }
  } else {
    return res.status(400).json({ error: 'solo puedes saltar después de equivocarte al menos una vez' });
  }

  const attemptsLeft = await getAttemptsLeft(quizId);
  if (attemptsLeft <= 0) {
    return res.status(400).json({ error: 'sin intentos restantes' });
  }

  if (existingSub.length > 0) {
    await db.update(submissions)
      .set({ kind: 'skipped' })
      .where(eq(submissions.id, existingSub[0].id));
  }

  const newAttemptsLeft = await decrementAttempts(quizId);

  return res.json({
    saved: true,
    skipped: true,
    attemptsLeft: newAttemptsLeft,
    maxAttempts: MAX_ATTEMPTS,
    quizQuestionId: qq.id,
  });
}

export async function getQuizResults(req, res) {
  const quizId = parseInt(req.params.quizId, 10);
  if (!Number.isInteger(quizId)) {
    return res.status(400).json({ error: 'quizId invalido' });
  }

  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (quizRows.length === 0) {
    return res.status(404).json({ error: 'quiz no encontrado' });
  }
  const quiz = quizRows[0];

  if (!quiz.completedAt) {
    await db.update(quizzes).set({ completedAt: new Date() }).where(eq(quizzes.id, quizId));
  }

  const qqRows = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId));

  const questionsData = [];
  for (const qq of qqRows) {
    const q = (await db.select().from(questions).where(eq(questions.id, qq.questionId)).limit(1))[0];
    const subs = await db.select().from(submissions).where(eq(submissions.quizQuestionId, qq.id)).limit(1);
    questionsData.push({ qq, q, submission: subs[0] || null });
  }

  const totalScore = questionsData.reduce((sum, item) => sum + (item.submission?.score || 0), 0);

  res.json({
    quizId,
    totalScore,
    language: quiz.language,
    questions: questionsData
      .sort((a, b) => a.qq.order - b.qq.order)
      .map(item => {
        const sub = item.submission;
        const isMc = item.q.type === 'multiple_choice';
        const options = isMc ? (item.q.options || []) : null;
        const correctOption = isMc ? item.q.correctOption : null;
        const correctAnswer = isMc
          ? (typeof correctOption === 'number' ? options[correctOption] : null)
          : (item.q.solution || null);

        let userAnswerIndex = null;
        let userAnswerText = null;
        if (isMc && sub?.code) {
          try {
            const parsed = JSON.parse(sub.code);
            if (typeof parsed.answer === 'number' && options) {
              userAnswerIndex = parsed.answer;
              userAnswerText = options[parsed.answer] ?? null;
            }
          } catch (_) { /* ignore */ }
        } else if (!isMc && sub?.code) {
          userAnswerText = sub.code;
        }

        const sandbox = sub?.sandboxResults || null;
        const isCorrect = sandbox?._isCorrect === true
          || (sandbox?.success === true && (sandbox?.total || 0) > 0 && (sandbox?.passed || 0) === (sandbox?.total || 0));

        const status = !sub ? 'skipped' : (isCorrect ? 'passed' : 'failed');

        return {
          id: item.q.id,
          title: item.q.title,
          description: item.q.description,
          language: item.q.language,
          type: item.q.type,
          order: item.qq.order,
          options,
          correctOption,
          correctAnswer,
          solutions: Array.isArray(item.q.solutions) ? item.q.solutions : null,
          userAnswerIndex,
          userAnswerText,
          isCorrect,
          status,
          submission: sub
            ? {
                code: sub.code,
                score: sub.score,
                sandbox,
                evaluatedAt: sub.evaluatedAt,
                kind: sub.kind,
              }
            : null,
        };
      }),
  });
}
