import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { questions } from '../drizzle/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, '..', 'seeds', 'tests');

const SUPPORTED_LANGS = ['sql', 'js-avanzado', 'node', 'html-css-js'];

let queue = Promise.resolve();
function enqueue(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

function testsFilePath(language) {
  return path.join(TESTS_DIR, `${language}.json`);
}

function readTestsFile(language) {
  const fp = testsFilePath(language);
  if (!existsSync(fp)) return {};
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'));
  } catch (e) {
    console.warn(`[question-export] ${fp} corrupto, tratando como vacío: ${e.message}`);
    return {};
  }
}

function writeTestsFileAtomic(language, data) {
  const fp = testsFilePath(language);
  const tmp = fp + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmp, fp);
}

export async function updateTestEntry(language, questionId, testsArray) {
  return enqueue(async () => {
    if (!SUPPORTED_LANGS.includes(language)) {
      throw new Error(`Lenguaje no soportado: ${language}`);
    }
    const data = readTestsFile(language);
    data[String(questionId)] = Array.isArray(testsArray) ? testsArray : [];
    writeTestsFileAtomic(language, data);
    console.log(`[question-export] update ${language}[${questionId}] (${data[String(questionId)].length} tests)`);
  });
}

export async function removeTestEntry(language, questionId) {
  return enqueue(async () => {
    if (!SUPPORTED_LANGS.includes(language)) {
      throw new Error(`Lenguaje no soportado: ${language}`);
    }
    const data = readTestsFile(language);
    delete data[String(questionId)];
    writeTestsFileAtomic(language, data);
    console.log(`[question-export] remove ${language}[${questionId}]`);
  });
}

export async function regenerateAllTestsFiles() {
  return enqueue(async () => {
    mkdirSync(TESTS_DIR, { recursive: true });

    const byLang = {};
    for (const lang of SUPPORTED_LANGS) byLang[lang] = {};

    const rows = await db
      .select({
        id: questions.id,
        language: questions.language,
        testsTemplate: questions.testsTemplate,
      })
      .from(questions)
      .where(and(eq(questions.isActive, true), isNull(questions.archivedAt)));

    for (const row of rows) {
      if (!SUPPORTED_LANGS.includes(row.language)) continue;
      if (!Array.isArray(row.testsTemplate) || row.testsTemplate.length === 0) continue;
      byLang[row.language][String(row.id)] = row.testsTemplate;
    }

    for (const lang of SUPPORTED_LANGS) {
      writeTestsFileAtomic(lang, byLang[lang]);
      const count = Object.keys(byLang[lang]).length;
      console.log(`[question-export] regenerate ${lang}.json (${count} questions)`);
    }

    return byLang;
  });
}

export function getTestEntry(language, questionId) {
  const data = readTestsFile(language);
  return data[String(questionId)] || null;
}
