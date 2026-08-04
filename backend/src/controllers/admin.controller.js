import crypto from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions, quizzes, quizQuestions } from '../drizzle/schema.js';
import { upsertQuestionInJson, removeQuestionFromJson } from '../services/questions-json-sync.js';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function sanitizeReturnUrl(raw) {
  if (typeof raw !== 'string') return '/admin';
  if (!raw.startsWith('/admin') || raw.startsWith('//')) return '/admin';
  return raw;
}

export async function getDashboard(req, res, next) {
  try {
    const { language, type } = req.query;
    const wheres = [eq(questions.isActive, true)];
    if (language) wheres.push(eq(questions.language, language));
    if (type === 'code' || type === 'multiple_choice') {
      wheres.push(eq(questions.type, type));
    }

    const rows = await db.select().from(questions)
      .where(and(...wheres))
      .orderBy(asc(questions.language), asc(questions.id));

    const langs = await db.selectDistinct({ language: questions.language }).from(questions);

    const enrichedRows = rows.map(q => ({
      ...q,
      hasSolution: q.type === 'multiple_choice'
        ? Number.isFinite(q.correctOption)
        : (!!(q.solution && q.solution.trim()) || (Array.isArray(q.solutions) && q.solutions.length > 0)),
    }));

    const params = new URLSearchParams();
    if (language) params.set('language', language);
    if (type) params.set('type', type);
    const qs = params.toString();
    const returnUrl = qs ? `/admin?${qs}` : '/admin';
    const returnUrlEncoded = encodeURIComponent(returnUrl);

    res.render('pages/dashboard', {
      questions: enrichedRows,
      languages: langs.map(l => l.language).sort(),
      filters: { language, type },
      returnUrl,
      returnUrlEncoded,
    });
  } catch (err) {
    next(err);
  }
}

export async function getNewQuestionForm(req, res, next) {
  try {
    const langs = await db.selectDistinct({ language: questions.language }).from(questions);
    const returnUrl = sanitizeReturnUrl(req.query.return);
    res.render('pages/admin/question-form', {
      question: null,
      languages: langs.map(l => l.language).sort(),
      values: { solution: '', solutions: [] },
      error: null,
      returnUrl,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEditQuestionForm(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    if (rows.length === 0) return res.status(404).send('Pregunta no encontrada');
    const langs = await db.selectDistinct({ language: questions.language }).from(questions);
    const values = { ...rows[0] };
    if (!Array.isArray(values.solutions)) values.solutions = [];
    const returnUrl = sanitizeReturnUrl(req.query.return);
    res.render('pages/admin/question-form', {
      question: rows[0],
      languages: langs.map(l => l.language).sort(),
      values,
      error: null,
      returnUrl,
    });
  } catch (err) {
    next(err);
  }
}

function parseSolutionsFromForm(body) {
  const raw = body.solutions;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((s) => {
      if (!s) return null;
      const code = (s.code || '').trim();
      if (!code) return null;
      let tests = [];
      if (typeof s.tests === 'string') {
        try {
          tests = JSON.parse(s.tests);
        } catch {
          tests = [];
        }
      } else if (Array.isArray(s.tests)) {
        tests = s.tests;
      }
      if (!Array.isArray(tests) || tests.length === 0) return null;
      return { code, tests };
    })
    .filter(Boolean);
}

function parseFormPayload(body) {
  const type = body.type === 'multiple_choice' ? 'multiple_choice' : 'code';
  const payload = {
    type,
    language: body.language || 'javascript',
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    solution: (body.solution || '').trim() || null,
  };

  if (type === 'multiple_choice') {
    let options = [];
    if (Array.isArray(body.options)) {
      options = body.options.map(s => String(s || '').trim()).filter(Boolean);
    } else if (typeof body.options === 'string') {
      options = body.options.split('\n').map(s => s.trim()).filter(Boolean);
    }
    payload.options = options;
    payload.correctOption = parseInt(body.correctOption, 10);
    payload.starterCode = null;
    payload.testsTemplate = null;
    payload.solutions = [];
  } else {
    payload.starterCode = body.starterCode || '';
    payload.testsTemplate = null;
    payload.options = null;
    payload.correctOption = null;

    const solutionsFromForm = parseSolutionsFromForm(body);
    payload.solutions = solutionsFromForm;
  }
  return payload;
}

function renderFormError(req, res, question, errorMsg, languages) {
  return res.status(400).render('pages/admin/question-form', {
    question,
    languages,
    values: req.body,
    error: errorMsg,
  });
}

export async function postCreateQuestion(req, res, next) {
  try {
    const payload = parseFormPayload(req.body);
    const langs = await db.selectDistinct({ language: questions.language }).from(questions);

    if (!payload.title || !payload.description || !payload.language) {
      return renderFormError(req, res, null, 'Título, descripción y lenguaje son requeridos', langs.map(l => l.language).sort());
    }
    if (payload.type === 'code' && !payload.starterCode) {
      return renderFormError(req, res, null, 'Starter code es requerido para preguntas de código', langs.map(l => l.language).sort());
    }
    if (payload.type === 'code' && (!payload.solutions || payload.solutions.length === 0)) {
      return renderFormError(req, res, null, 'Al menos una solución con sus tests es requerida para preguntas de código', langs.map(l => l.language).sort());
    }
    if (payload.type === 'multiple_choice' && (!payload.options.length || !Number.isFinite(payload.correctOption) || payload.correctOption < 0 || payload.correctOption >= payload.options.length)) {
      return renderFormError(req, res, null, 'Se requieren al menos 2 opciones y un índice de respuesta correcta válido', langs.map(l => l.language).sort());
    }

    const hash = md5(payload.title + payload.description);

    const inserted = await db.insert(questions).values({
      language: payload.language,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      starterCode: payload.starterCode,
      testsTemplate: payload.testsTemplate,
      options: payload.options,
      correctOption: payload.correctOption,
      solution: payload.solution,
      solutions: payload.solutions,
      hash,
    }).returning({ id: questions.id });

    const newId = inserted[0]?.id;
    if (newId !== undefined && newId !== null) {
      await upsertQuestionInJson(payload, newId);
    }

    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
}

export async function postUpdateQuestion(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const payload = parseFormPayload(req.body);
    const langs = await db.selectDistinct({ language: questions.language }).from(questions);
    const current = (await db.select().from(questions).where(eq(questions.id, id)).limit(1))[0];

    if (!payload.title || !payload.description || !payload.language) {
      return renderFormError(req, res, current, 'Título, descripción y lenguaje son requeridos', langs.map(l => l.language).sort());
    }
    if (payload.type === 'code' && !payload.starterCode) {
      return renderFormError(req, res, current, 'Starter code es requerido para preguntas de código', langs.map(l => l.language).sort());
    }
    if (payload.type === 'code' && (!payload.solutions || payload.solutions.length === 0)) {
      return renderFormError(req, res, current, 'Al menos una solución con sus tests es requerida para preguntas de código', langs.map(l => l.language).sort());
    }
    if (payload.type === 'multiple_choice' && (!payload.options.length || !Number.isFinite(payload.correctOption) || payload.correctOption < 0 || payload.correctOption >= payload.options.length)) {
      return renderFormError(req, res, current, 'Se requieren al menos 2 opciones y un índice de respuesta correcta válido', langs.map(l => l.language).sort());
    }

    const hash = md5(payload.title + payload.description);
    await db.update(questions).set({
      language: payload.language,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      starterCode: payload.starterCode,
      testsTemplate: payload.testsTemplate,
      options: payload.options,
      correctOption: payload.correctOption,
      solution: payload.solution,
      solutions: payload.solutions,
      hash,
    }).where(eq(questions.id, id));

    await upsertQuestionInJson(payload, id);

    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
}

export async function postDeleteQuestion(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await db.update(questions).set({ isActive: false }).where(eq(questions.id, id));
    await removeQuestionFromJson(id);
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
}

export async function postPreviewQuestion(req, res, next) {
  try {
    const questionId = parseInt(req.body?.questionId, 10);
    if (!Number.isInteger(questionId)) {
      return res.status(400).json({ error: 'questionId requerido' });
    }
    const qRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (qRows.length === 0) {
      return res.status(404).json({ error: 'pregunta no encontrada' });
    }
    const q = qRows[0];

    const [quiz] = await db.insert(quizzes).values({
      userId: req.user.id,
      language: q.language,
    }).returning();

    await db.insert(quizQuestions).values([{
      quizId: quiz.id,
      questionId: q.id,
      order: 1,
    }]);

    res.json({ quizId: quiz.id });
  } catch (err) {
    next(err);
  }
}
