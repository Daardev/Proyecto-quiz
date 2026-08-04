import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const QUESTIONS_JSON_PATH = path.join(__dirname, '..', 'seeds', 'questions-batch.json');

let queue = Promise.resolve();

function enqueue(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

function md5(s) {
  return crypto.createHash('md5').update(String(s || '')).digest('hex');
}

function readJson() {
  const txt = fs.readFileSync(QUESTIONS_JSON_PATH, 'utf-8');
  return JSON.parse(txt);
}

function writeJsonAtomic(data) {
  const tmp = QUESTIONS_JSON_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, QUESTIONS_JSON_PATH);
}

function mapPayloadToJsonEntry(p, id) {
  const entry = {
    id,
    type: p.type,
    language: p.language,
    title: p.title,
    description: p.description,
  };
  if (p.type === 'multiple_choice') {
    return {
      ...entry,
      options: Array.isArray(p.options) ? p.options : [],
      correctOption: Number.isFinite(p.correctOption) ? p.correctOption : 0,
      starterCode: null,
      tests: null,
      solution: p.solution || null,
    };
  }
  const firstSolutionTests = Array.isArray(p.solutions) && p.solutions.length > 0
    ? (p.solutions[0].tests || [])
    : [];
  return {
    ...entry,
    starterCode: p.starterCode || '',
    tests: firstSolutionTests,
    solution: p.solution || null,
    solutions: Array.isArray(p.solutions) ? p.solutions : [],
  };
}

export async function upsertQuestionInJson(payload, id) {
  return enqueue(async () => {
    try {
      const data = readJson();
      const newHash = md5((payload.title || '') + (payload.description || ''));
      let idx = -1;
      if (id !== undefined && id !== null) {
        idx = data.findIndex((q) => Number(q.id) === Number(id));
      }
      if (idx === -1) idx = data.findIndex((q) => q.hash === newHash);
      const entry = { ...mapPayloadToJsonEntry(payload, id), hash: newHash };
      if (idx >= 0) data[idx] = entry;
      else data.push(entry);
      writeJsonAtomic(data);
      console.log(`[json-sync] upsert id=${id} hash=${newHash} title="${(payload.title || '').substring(0, 40)}"`);
    } catch (err) {
      console.warn(`[json-sync] UPSERT FAILED id=${id}: ${err.message} — BD is committed but JSON desynced. Run scripts/sync-bd-to-json.mjs to repair.`);
    }
  });
}

export async function removeQuestionFromJson(id) {
  return enqueue(async () => {
    try {
      const data = readJson();
      const before = data.length;
      const filtered = data.filter((q) => Number(q.id) !== Number(id));
      if (filtered.length === before) {
        console.log(`[json-sync] remove id=${id} not found in JSON, skipping`);
        return;
      }
      writeJsonAtomic(filtered);
      console.log(`[json-sync] removed id=${id} from JSON`);
    } catch (err) {
      console.warn(`[json-sync] REMOVE FAILED id=${id}: ${err.message} — BD is committed but JSON desynced.`);
    }
  });
}

export function getQuestionsJsonPath() {
  return QUESTIONS_JSON_PATH;
}
