import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions, quizzes, quizQuestions, submissions } from '../drizzle/schema.js';

export async function getLanguagesData() {
  const rows = await db.selectDistinct({ language: questions.language }).from(questions).where(eq(questions.isActive, true));
  return rows.map(r => r.language).sort();
}

export async function getLanguagesDataWithCounts() {
  const rows = await db.select({
    language: questions.language,
    count: sql`count(*)::int`.as('count'),
  })
    .from(questions)
    .where(eq(questions.isActive, true))
    .groupBy(questions.language);
  return rows
    .map(r => ({ language: r.language, count: r.count ?? 0 }))
    .sort((a, b) => a.language.localeCompare(b.language));
}

export async function getLanguages(req, res) {
  try {
    const languages = await getLanguagesData();
    res.json({ languages });
  } catch (err) {
    console.error('[getLanguages] error:', err);
    res.status(500).json({ error: 'error al obtener lenguajes' });
  }
}

export async function generateQuiz(req, res) {
  try {
    const { language, count } = req.body || {};

    if (!language) {
      return res.status(400).json({ error: 'language es requerido' });
    }

    const poolAll = await db.select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.language, language), eq(questions.isActive, true)));
    const totalAvailable = poolAll.length;

    if (totalAvailable === 0) {
      return res.status(404).json({ error: `no hay preguntas disponibles para el lenguaje "${language}"` });
    }

    const parsed = parseInt(count, 10);
    const numQuestions = Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, totalAvailable)
      : totalAvailable;

    const pool = await db.select().from(questions)
      .where(and(eq(questions.language, language), eq(questions.isActive, true)))
      .orderBy(sql`RANDOM()`)
      .limit(numQuestions);

    const [quiz] = await db.insert(quizzes).values({
      userId: req.user?.id || null,
      language,
    }).returning();

    const quizQuestionRows = pool.map((q, idx) => ({
      quizId: quiz.id,
      questionId: q.id,
      order: idx + 1,
    }));

    await db.insert(quizQuestions).values(quizQuestionRows);

    res.status(201).json({
      quizId: quiz.id,
      count: pool.length,
      totalAvailable,
      language,
    });
  } catch (err) {
    console.error('[generateQuiz] error:', err);
    res.status(500).json({ error: 'error al generar quiz' });
  }
}

function isQuestionDone(sub) {
  if (!sub) return false;
  if (sub.kind === 'skipped') return true;
  const sr = sub.sandboxResults;
  return sr?.success === true
    && (sr?.total || 0) > 0
    && (sr?.passed || 0) === (sr?.total || 0);
}

function toQuestionPayload(qq, q, attemptsLeft) {
  return {
    quizQuestionId: qq.id,
    questionId: q.id,
    order: qq.order,
    total: qq.total,
    type: q.type,
    language: q.language,
    title: q.title,
    description: q.description,
    starterCode: q.starterCode,
    options: q.options,
    difficulty: q.difficulty,
    attemptsLeft,
    maxAttempts: 5,
    attemptsCount: qq.attemptsCount ?? 0,
  };
}

export async function getCurrentQuestionData(quizId) {
  if (!Number.isInteger(quizId)) {
    return { __error: 400, error: 'quizId invalido' };
  }

  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (quizRows.length === 0) {
    return { __error: 404, error: 'quiz no encontrado' };
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
    .orderBy(sql`${submissions.id} DESC`)
    .limit(1)
    .as('last_sub');

  const rows = await db.select({
    qqId: quizQuestions.id,
    qqOrder: quizQuestions.order,
    qqAttemptsCount: quizQuestions.attemptsCount,
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

  if (rows.length === 0) {
    return { __error: 404, error: 'quiz sin preguntas' };
  }

  const total = rows.length;
  const ordered = rows.map(r => ({
    qq: { id: r.qqId, order: r.qqOrder, attemptsCount: r.qqAttemptsCount },
    question: r.q,
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

  const allResolved = ordered.every(o => isQuestionDone(o.submission));

  if (allResolved || quiz.attemptsLeft <= 0) {
    return { done: true, quizId };
  }

  const next = ordered.find(o => !isQuestionDone(o.submission));
  if (!next) {
    return { done: true, quizId };
  }

  next.qq.total = total;
  return toQuestionPayload(next.qq, next.question, quiz.attemptsLeft);
}

export async function getCurrentQuestion(req, res) {
  try {
    const quizId = parseInt(req.params.quizId, 10);
    const data = await getCurrentQuestionData(quizId);

    if (data.__error) {
      return res.status(data.__error).json({ error: data.error });
    }

    if (data.done) {
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      return res.json(data);
    }

    const etag = `"${quizId}-${data.quizQuestionId}-${data.attemptsCount}-${data.attemptsLeft}"`;
    if (req.headers['if-none-match'] === etag) {
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      return res.status(304).end();
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    return res.json(data);
  } catch (err) {
    console.error('[getCurrentQuestion] error:', err);
    res.status(500).json({ error: 'error al obtener pregunta actual' });
  }
}
