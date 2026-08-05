import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, '..', 'seeds', 'tests');

let cache = null;

function loadTestsFiles() {
  if (cache) return cache;
  cache = {};
  for (const lang of ['sql', 'js-avanzado', 'node', 'html-css-js']) {
    const file = path.join(TESTS_DIR, `${lang}.json`);
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      cache[lang] = data;
    } catch (e) {
      cache[lang] = {};
    }
  }
  return cache;
}

export function getTestsForQuestion(language, id) {
  const data = loadTestsFiles();
  const langData = data[language] || {};
  return langData[String(id)] || null;
}

export function reloadTestsCache() {
  cache = null;
  return loadTestsFiles();
}

export function hasTestsFor(language, id) {
  return getTestsForQuestion(language, id) !== null;
}
