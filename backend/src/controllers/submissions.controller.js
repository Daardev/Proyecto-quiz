import { eq, and, sql } from 'drizzle-orm';
import { db, pool } from '../config/database.js';
import { quizzes, quizQuestions, submissions, questions } from '../drizzle/schema.js';
import { executeCodeInSandbox, evaluateMultipleChoice, evaluateMarkup, runAgainstSolutions, runPreview } from '../services/sandbox.service.js';

const MAX_PREVIEWS_PER_QUESTION = 10;

function isSubmissionCorrect(sandboxResult) {
  if (sandboxResult?._isCorrect === true) return true;
  return sandboxResult?.success === true
    && (sandboxResult?.total || 0) > 0
    && (sandboxResult?.passed || 0) === (sandboxResult?.total || 0);
}

async function incrementPreviewsUsed(quizQuestionId) {
  const r = await pool.query(
    `UPDATE quiz_questions
        SET previews_used = previews_used + 1
      WHERE id = $1
      RETURNING previews_used`,
    [quizQuestionId]
  );
  return r.rows[0]?.previews_used ?? 0;
}

async function runUserCode(question, code) {
  const language = (question.language || '').toLowerCase();
  if (Array.isArray(question.solutions) && question.solutions.length > 0) {
    return runAgainstSolutions(code, language, question.solutions, question.setupCode);
  }
  const category = language === 'sql' ? 'postgresql' : language;
  const tests = question.testsTemplate || [];
  if (language === 'html-css-js') {
    return evaluateMarkup(code, tests);
  }
  return executeCodeInSandbox(code, category, tests, question.setupCode);
}

export async function previewCode(req, res) {
  const quizId = parseInt(req.params.quizId, 10);
  const { questionId, code } = req.body || {};

  if (!Number.isInteger(quizId)) {
    return res.status(400).json({ error: 'quizId invalido' });
  }
  if (!Number.isInteger(parseInt(questionId, 10))) {
    return res.status(400).json({ error: 'questionId requerido' });
  }
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'code es requerido' });
  }

  const rows = await db.select({
    qqId: quizQuestions.id,
    qqPreviewsUsed: quizQuestions.previewsUsed,
  })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)))
    .limit(1);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'pregunta no encontrada en este quiz' });
  }

  const qqPreviewsUsed = Number(rows[0].qqPreviewsUsed) || 0;
  if (qqPreviewsUsed >= MAX_PREVIEWS_PER_QUESTION) {
    return res.status(409).json({
      error: 'previews_exhausted',
      previewsUsed: qqPreviewsUsed,
      previewsLimit: MAX_PREVIEWS_PER_QUESTION,
      previewsLeft: 0,
    });
  }

  const qRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (qRows.length === 0) {
    return res.status(404).json({ error: 'pregunta no existe' });
  }
  const question = qRows[0];

  const tests = (Array.isArray(question.testsTemplate) && question.testsTemplate.length > 0)
    ? question.testsTemplate
    : (Array.isArray(question.solutions) && question.solutions[0]?.tests) || [];
  const result = await runPreview(code, question.language, question.setupCode || '', tests);

  const newPreviewsUsed = await incrementPreviewsUsed(rows[0].qqId);
  const previewsLeft = Math.max(0, MAX_PREVIEWS_PER_QUESTION - newPreviewsUsed);

  return res.json({
    ...result,
    previewsUsed: newPreviewsUsed,
    previewsLimit: MAX_PREVIEWS_PER_QUESTION,
    previewsLeft,
  });
}

export async function finishQuiz(req, res) {
  const quizId = parseInt(req.params.quizId, 10);
  const { answers } = req.body || {};

  if (!Number.isInteger(quizId)) {
    return res.status(400).json({ error: 'quizId invalido' });
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers (array) es requerido' });
  }

  const qqRows = await db.select({
    qqId: quizQuestions.id,
    qqOrder: quizQuestions.order,
    questionId: quizQuestions.questionId,
    question: questions,
  })
    .from(quizQuestions)
    .leftJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quizId));

  if (qqRows.length === 0) {
    return res.status(404).json({ error: 'quiz sin preguntas' });
  }

  const answersByQId = new Map();
  for (const a of answers) {
    if (a && a.questionId != null) {
      answersByQId.set(a.questionId, a);
    }
  }

  let saved = 0;
  for (const row of qqRows) {
    const qq = { id: row.qqId, order: row.qqOrder };
    const question = row.question;
    if (!question) continue;

    const answer = answersByQId.get(question.id);
    const isExplicitlySkipped = !!(answer && answer.skipped === true);

    const isCodeAnswerEmpty = (question.type !== 'multiple_choice')
      && (!answer || typeof answer.code !== 'string' || answer.code.trim() === '');
    const isMcAnswerEmpty = (question.type === 'multiple_choice')
      && (!answer || answer.option === undefined || answer.option === null);

    const isImplicitlySkipped = isCodeAnswerEmpty || isMcAnswerEmpty;

    let submission;

    if (isExplicitlySkipped || isImplicitlySkipped) {
      submission = {
        quizQuestionId: qq.id,
        code: '(skipped)',
        sandboxResults: null,
        score: 0,
        evaluatedAt: new Date(),
        kind: 'skipped',
      };
    } else if (question.type === 'multiple_choice') {
      const option = answer.option;
      const sandboxResult = evaluateMultipleChoice(option, question.correctOption);
      const isCorrect = isSubmissionCorrect(sandboxResult);
      const score = isCorrect ? 100 : 0;
      submission = {
        quizQuestionId: qq.id,
        code: JSON.stringify({ option }),
        sandboxResults: { ...sandboxResult, _isCorrect: isCorrect },
        score,
        evaluatedAt: new Date(),
        kind: 'answer',
      };
    } else {
      const code = answer.code;
      const sandboxResult = await runUserCode(question, code);
      const isCorrect = isSubmissionCorrect(sandboxResult);
      const score = isCorrect
        ? (sandboxResult?._isCorrect === true
            ? 100
            : Math.round(((sandboxResult.passed || 0) / (sandboxResult.total || 1)) * 100))
        : 0;
      submission = {
        quizQuestionId: qq.id,
        code,
        sandboxResults: { ...sandboxResult, _isCorrect: isCorrect },
        score,
        evaluatedAt: new Date(),
        kind: 'answer',
      };
    }

    await db.insert(submissions)
      .values(submission)
      .onConflictDoUpdate({
        target: submissions.quizQuestionId,
        set: {
          code: submission.code,
          sandboxResults: submission.sandboxResults,
          score: submission.score,
          evaluatedAt: submission.evaluatedAt,
          kind: submission.kind,
        },
      });
    saved++;
  }

  await db.update(quizzes)
    .set({ completedAt: new Date() })
    .where(eq(quizzes.id, quizId));

  return res.json({ success: true, saved });
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

  const lastSub = db
    .select({
      id: submissions.id,
      quizQuestionId: submissions.quizQuestionId,
      code: submissions.code,
      sandboxResults: submissions.sandboxResults,
      score: submissions.score,
      evaluatedAt: submissions.evaluatedAt,
      kind: submissions.kind,
    })
    .from(submissions)
    .where(eq(submissions.quizQuestionId, quizQuestions.id))
    .orderBy(submissions.id)
    .limit(1)
    .as('last_sub');

  const rows = await db.select({
    qqId: quizQuestions.id,
    qqOrder: quizQuestions.order,
    q: questions,
    subId: lastSub.id,
    subQuizQuestionId: lastSub.quizQuestionId,
    subCode: lastSub.code,
    subSandbox: lastSub.sandboxResults,
    subScore: lastSub.score,
    subEvaluatedAt: lastSub.evaluatedAt,
    subKind: lastSub.kind,
  })
    .from(quizQuestions)
    .leftJoin(questions, eq(questions.id, quizQuestions.questionId))
    .leftJoinLateral(lastSub, sql`true`)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.order);

  const questionsData = rows.map(r => ({
    qq: { id: r.qqId, order: r.qqOrder },
    q: r.q,
    submission: r.subId == null ? null : {
      id: r.subId,
      quizQuestionId: r.subQuizQuestionId,
      code: r.subCode,
      sandboxResults: r.subSandbox,
      score: r.subScore,
      evaluatedAt: r.subEvaluatedAt,
      kind: r.subKind,
    },
  }));

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
            if (typeof parsed.option === 'number' && options) {
              userAnswerIndex = parsed.option;
              userAnswerText = options[parsed.option] ?? null;
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
