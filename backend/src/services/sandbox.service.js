import { newQuickJSAsyncWASMModule } from 'quickjs-emscripten';
import { PGlite } from '@electric-sql/pglite';

let quickJsModule = null;
async function getQuickJsModule() {
  if (!quickJsModule) {
    quickJsModule = await newQuickJSAsyncWASMModule();
  }
  return quickJsModule;
}

function tryJsonParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

export async function executeJavaScript(userCode, tests = [], setupCode = '') {
  const QuickJS = await getQuickJsModule();
  const runtime = QuickJS.newRuntime();
  const ctx = runtime.newContext();
  const results = [];
  let passed = 0;

  const fnMatch = userCode.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/);
  const fnName = fnMatch?.[1] || fnMatch?.[2];
  if (!fnName) {
    ctx.dispose();
    runtime.dispose();
    return {
      success: false,
      error: 'No se encontró ninguna función definida en el código',
      passed: 0,
      total: tests.length,
      results: [],
    };
  }

  try {
    for (const test of tests) {
      try {
        const args = Array.isArray(test.input) ? test.input : [test.input];
        const argsJson = args.map(a => JSON.stringify(a)).join(', ');
        const wrapped = [
          '"use strict";',
          'var __result = "__PENDING__";',
          setupCode,
          userCode,
          `(async function __run__() {`,
          `  try {`,
          `    __result = JSON.stringify(await ${fnName}(${argsJson}));`,
          `  } catch (e) {`,
          `    __result = "__ERROR__:" + (e && e.message ? e.message : String(e));`,
          `  }`,
          `})();`,
        ].join('\n');

        const handle = ctx.evalCode(wrapped);
        if (handle.error) {
          const err = ctx.dump(handle.error);
          handle.error.dispose();
          handle.value.dispose();
          const msg = typeof err === 'object' && err !== null ? err.message : String(err);
          results.push({ passed: false, error: msg });
          continue;
        }

        let out = '__PENDING__';
        for (let i = 0; i < 2000; i++) {
          runtime.executePendingJobs();
          const rp = ctx.getProp(ctx.global, '__result');
          const s = ctx.getString(rp);
          rp.dispose();
          if (s !== '__PENDING__') {
            out = s;
            break;
          }
        }
        handle.value.dispose();

        if (out.startsWith('__ERROR__:')) {
          results.push({ passed: false, error: out.slice('__ERROR__:'.length) });
          continue;
        }
        const expectedJson = JSON.stringify(test.expected);
        const isPassed = out === expectedJson;
        if (isPassed) passed++;
        results.push({
          passed: isPassed,
          actual: tryJsonParse(out),
        });
      } catch (e) {
        results.push({ passed: false, error: e.message });
      }
    }
  } finally {
    ctx.dispose();
    runtime.dispose();
  }

  return { success: true, passed, total: tests.length, results };
}

function isSelectableStatement(code) {
  const trimmed = (code || '').trim().toLowerCase();
  if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) return false;
  return !/\b(insert|update|delete|merge|create|drop|alter|truncate|grant|revoke)\b/i.test(code);
}

function isPgResultEquivalent(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  if (actual.length !== expected.length) return false;
  const normalise = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string') {
      const n = Number(v);
      if (!Number.isNaN(n) && v.trim() !== '') return n;
    }
    return v;
  };
  for (let i = 0; i < actual.length; i++) {
    const aRow = actual[i] || {};
    const eRow = expected[i] || {};
    const aKeys = Object.keys(aRow);
    const eKeys = Object.keys(eRow);
    if (aKeys.length !== eKeys.length) return false;
    for (let j = 0; j < aKeys.length; j++) {
      if (normalise(aRow[aKeys[j]]) !== normalise(eRow[eKeys[j]])) return false;
    }
  }
  return true;
}

export async function executePostgres(userCode, tests = [], setupCode = '') {
  const results = [];
  let passed = 0;

  for (const test of tests) {
    const db = new PGlite();
    try {
      if (setupCode) await db.exec(setupCode);
      await db.exec(userCode);

      let queryResult;
      if (isSelectableStatement(userCode)) {
        queryResult = await db.query(userCode);
      } else {
        queryResult = await db.query(test.input);
      }

      const actual = JSON.stringify(queryResult.rows);
      const expected = JSON.stringify(test.expected);
      let isPassed = actual === expected;
      if (!isPassed) {
        isPassed = isPgResultEquivalent(queryResult.rows, test.expected);
      }
      if (isPassed) passed++;
      results.push({ passed: isPassed, actual: queryResult.rows });
    } catch (e) {
      results.push({ passed: false, error: e.message });
    } finally {
      await db.close();
    }
  }

  return { success: true, passed, total: tests.length, results };
}

export async function previewPostgres(userCode, setupCode = '', tests = []) {
  try {
    if (!userCode || !userCode.trim()) {
      return {
        ok: false,
        kind: 'sql',
        error: 'Falta código SQL. Escribe la consulta en el panel derecho.',
        passed: 0,
        total: tests.length,
      };
    }
    const db = new PGlite();
    try {
      if (setupCode) await db.exec(setupCode);
      await db.exec(userCode);

      let queryResult;
      if (isSelectableStatement(userCode)) {
        queryResult = await db.query(userCode);
      } else if (tests.length > 0) {
        queryResult = await db.query(tests[0].input);
      } else {
        return { ok: true, kind: 'sql', rows: [], passed: 1, total: 1, message: '// (ejecutado sin verificación)' };
      }

      let passed = 0;
      const total = tests.length;
      if (total > 0 && tests[0].expected !== undefined) {
        const expectedJson = JSON.stringify(tests[0].expected);
        if (JSON.stringify(queryResult.rows || []) === expectedJson) passed = 1;
      } else {
        passed = 1;
      }
      return { ok: true, kind: 'sql', rows: queryResult.rows || [], passed, total };
    } finally {
      await db.close();
    }
  } catch (e) {
    return { ok: false, kind: 'sql', error: e.message, passed: 0, total: tests.length };
  }
}

export async function previewJavaScript(userCode, setupCode = '', tests = []) {
  const QuickJS = await getQuickJsModule();
  const runtime = QuickJS.newRuntime();
  const ctx = runtime.newContext();
  try {
    const fnMatch = userCode.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/);
    const fnName = fnMatch?.[1] || fnMatch?.[2];

    if (!fnName) {
      return {
        ok: false,
        kind: 'js',
        error: 'Falta definir una función. Define una función con `function nombre() {}` o `const nombre = () => {}`.',
        passed: 0,
        total: tests.length,
      };
    }

    const firstTest = Array.isArray(tests) && tests.length > 0 ? tests[0] : null;
    const sampleRaw = firstTest?.input !== undefined ? firstTest.input : [];
    const sampleArgs = Array.isArray(sampleRaw) ? sampleRaw : [sampleRaw];
    const argsJson = JSON.stringify(sampleArgs).slice(1, -1);

    const wrapped = [
      '"use strict";',
      'var __result = "__PENDING__";',
      setupCode,
      userCode,
      `try { __result = JSON.stringify(${fnName}(${argsJson})); } catch (e) { __result = "__ERROR__:" + (e && e.message ? e.message : String(e)); }`,
    ].join('\n');

    const handle = ctx.evalCode(wrapped);
    if (handle.error) {
      const err = ctx.dump(handle.error);
      handle.error.dispose();
      const msg = typeof err === 'object' && err !== null ? err.message : String(err);
      return { ok: false, kind: 'js', error: `Error al compilar/ejecutar: ${msg}`, passed: 0, total: tests.length };
    }
    handle.value.dispose();

    const rp = ctx.getProp(ctx.global, '__result');
    const s = ctx.getString(rp);
    rp.dispose();

    if (s.startsWith('__ERROR__:')) {
      return { ok: false, kind: 'js', error: `La función ${fnName}() arrojó: ${s.slice('__ERROR__:'.length)}`, passed: 0, total: tests.length };
    }

    let parsed = s;
    try { parsed = JSON.parse(s); } catch { /* keep raw */ }

    let passed = 0;
    let total = tests.length;
    const testsList = [];
    if (total > 0 && firstTest && firstTest.expected !== undefined) {
      const expectedJson = JSON.stringify(firstTest.expected);
      if (s === expectedJson) {
        passed = 1;
        testsList.push({ check: 'function-call', passed: true, message: `Función ${fnName}() ejecutada correctamente` });
      } else {
        testsList.push({ check: 'function-call', passed: false, message: `Resultado no coincide (esperaba ${expectedJson}, obtuve ${s})` });
      }
    } else {
      passed = 1;
      total = 1;
      testsList.push({ check: 'function-call', passed: true, message: `Función ${fnName}() ejecutada` });
    }

    return { ok: true, kind: 'js', value: parsed, passed, total, tests: testsList };
  } catch (e) {
    return { ok: false, kind: 'js', error: e.message, passed: 0, total: tests.length };
  } finally {
    ctx.dispose();
    runtime.dispose();
  }
}

export async function previewMarkup(userCode, setupCode = '', tests = []) {
  try {
    if (!userCode || !userCode.trim()) {
      return {
        ok: false,
        kind: 'markup',
        error: 'Falta código HTML/CSS. Escribe el markup en el panel derecho.',
        passed: 0,
        total: tests.length,
      };
    }
    const result = evaluateMarkup(userCode, tests || []);
    return {
      ok: true,
      kind: 'markup',
      tests: result.results || [],
      passed: result.passed,
      total: result.total,
    };
  } catch (e) {
    return { ok: false, kind: 'markup', error: e.message, passed: 0, total: tests.length };
  }
}

export async function runPreview(userCode, language, setupCode = '', tests = []) {
  const lang = (language || '').toLowerCase();
  if (lang === 'sql') return previewPostgres(userCode, setupCode, tests);
  if (['javascript', 'js-avanzado', 'node'].includes(lang)) return previewJavaScript(userCode, setupCode, tests);
  if (lang === 'html-css-js') return previewMarkup(userCode, setupCode, tests || []);
  return { ok: false, kind: 'unknown', error: `Lenguaje no soportado para preview: ${language}`, passed: 0, total: 0 };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runMarkupCheck(code, test) {
  const { check, selector, expected, property, valueContains, attribute, parent, child } = test;
  const ok = (m, p) => ({ passed: p, message: m });

  switch (check) {
    case 'hasElement': {
      const pattern = new RegExp(`<${escapeRegex(selector)}\\b`, 'i');
      const passed = pattern.test(code);
      return ok(passed ? `Etiqueta <${selector}> encontrada` : `Falta la etiqueta <${selector}>`, passed);
    }
    case 'elementText': {
      const pattern = new RegExp(`<${escapeRegex(selector)}\\b[^>]*>\\s*${escapeRegex(expected)}\\s*</${escapeRegex(selector)}\\s*>`, 'i');
      const passed = pattern.test(code);
      return ok(passed ? `Texto "${expected}" encontrado en <${selector}>` : `Falta el texto "${expected}" en <${selector}>`, passed);
    }
    case 'elementInside': {
      if (!parent || !child) return ok(`Faltan parámetros parent/child en el test`, false);
      const outer = new RegExp(
        `<${escapeRegex(parent)}\\b[^>]*>([\\s\\S]*?)</${escapeRegex(parent)}\\s*>`,
        'i'
      );
      const match = code.match(outer);
      if (!match) return ok(`Falta el contenedor <${parent}>`, false);
      const passed = new RegExp(`<${escapeRegex(child)}\\b`, 'i').test(match[1]);
      return ok(passed ? `<${child}> está dentro de <${parent}>` : `<${child}> no está dentro de <${parent}>`, passed);
    }
    case 'hasStyle': {
      const styleRegex = new RegExp(`<${escapeRegex(selector)}\\b[^>]*style\\s*=\\s*"([^"]*)"`, 'i');
      const match = code.match(styleRegex);
      if (!match) return ok(`Falta el atributo style en <${selector}>`, false);
      const styles = match[1].split(';').map(s => s.trim()).filter(Boolean);
      for (const s of styles) {
        const colonIdx = s.indexOf(':');
        if (colonIdx === -1) continue;
        const prop = s.slice(0, colonIdx).trim().toLowerCase();
        if (prop !== String(property).toLowerCase()) continue;
        const value = s.slice(colonIdx + 1).trim();
        const passed = value.toLowerCase().includes(String(valueContains).toLowerCase());
        return ok(passed
          ? `Estilo "${property}" configurado correctamente (${value})`
          : `Estilo "${property}" no contiene "${valueContains}" (valor: "${value}")`, passed);
      }
      return ok(`Atributo style no incluye la propiedad "${property}"`, false);
    }
    case 'hasAttribute': {
      const attrRegex = new RegExp(`<${escapeRegex(selector)}\\b[^>]*${escapeRegex(attribute)}\\s*=\\s*"([^"]*)"`, 'i');
      const match = code.match(attrRegex);
      if (!match) {
        return ok(expected !== undefined
          ? `Falta el atributo ${attribute}="${expected}" en <${selector}>`
          : `Falta el atributo ${attribute} en <${selector}>`, false);
      }
      if (expected === undefined) return ok(`Atributo ${attribute} presente en <${selector}>`, true);
      const passed = match[1].includes(expected);
      return ok(passed
        ? `Atributo ${attribute} contiene "${expected}"`
        : `Atributo ${attribute} no contiene "${expected}" (encontré: "${match[1]}")`, passed);
    }
    case 'elementCount': {
      const tagRegex = new RegExp(`<${escapeRegex(selector)}\\b`, 'gi');
      const matches = code.match(tagRegex);
      const count = matches ? matches.length : 0;
      const expectedNum = Number(expected);
      const passed = count === expectedNum;
      return ok(passed
        ? `Cantidad correcta de <${selector}> (encontré ${count})`
        : `Cantidad incorrecta de <${selector}> (esperaba ${expectedNum}, encontré ${count})`, passed);
    }
    case 'hasClass':
    case 'hasId': {
      const attr = check === 'hasClass' ? 'class' : 'id';
      const re = new RegExp(`<${escapeRegex(selector)}\\b[^>]*\\b${attr}\\s*=\\s*"[^"]*\\b${escapeRegex(expected)}\\b`, 'i');
      const passed = re.test(code);
      return ok(passed
        ? `Atributo ${attr}="${expected}" presente en <${selector}>`
        : `Falta ${attr}="${expected}" en <${selector}>`, passed);
    }
    default:
      return ok(`Tipo de check desconocido: ${check}`, false);
  }
}

export function evaluateMarkup(userCode, tests = []) {
  const results = [];
  let passed = 0;

  for (const test of tests) {
    try {
      const result = runMarkupCheck(userCode, test);
      results.push({
        check: test.check,
        selector: test.selector,
        passed: result.passed,
        message: result.message,
      });
      if (result.passed) passed++;
    } catch (e) {
      results.push({ check: test.check, selector: test.selector, passed: false, message: `Error: ${e.message}` });
    }
  }

  return { success: true, passed, total: tests.length, results };
}

const executors = {
  javascript: executeJavaScript,
  node: executeJavaScript,
  postgresql: executePostgres,
  'html-css-js': evaluateMarkup,
};

export async function executeCodeInSandbox(code, category, tests = [], setupCode = '') {
  const fn = executors[category];
  if (!fn) {
    throw new Error(`Categoría no soportada: ${category}`);
  }
  return fn(code, tests, setupCode);
}

function resolveCategory(language) {
  const lang = (language || '').toLowerCase();
  if (lang === 'sql') return 'postgresql';
  if (lang === 'js-avanzado') return 'javascript';
  return lang;
}

export async function runAgainstSolutions(userCode, language, solutions, setupCode = '') {
  const list = Array.isArray(solutions) ? solutions : [];
  const category = resolveCategory(language);

  if (list.length === 0) {
    return {
      success: false,
      error: 'No hay soluciones registradas para evaluar',
      passed: 0,
      total: 0,
      results: [],
    };
  }

  const perSolution = [];
  let anyFullyPassed = false;
  let bestPassed = 0;
  let bestTotal = 0;

  for (const sol of list) {
    const tests = Array.isArray(sol.tests) ? sol.tests : [];

    let result;
    try {
      if (category === 'html-css-js') {
        result = evaluateMarkup(userCode, tests);
      } else if (executors[category]) {
        result = await executors[category](userCode, tests, setupCode);
      } else {
        result = { success: false, error: `Categoría no soportada: ${category}`, passed: 0, total: tests.length, results: [] };
      }
    } catch (e) {
      result = { success: false, error: e.message, passed: 0, total: tests.length, results: [] };
    }

    const fullyPassed = (result.total || 0) > 0 && (result.passed || 0) === (result.total || 0);
    if (fullyPassed) anyFullyPassed = true;
    if ((result.passed || 0) > bestPassed) bestPassed = result.passed;
    if ((result.total || 0) > bestTotal) bestTotal = result.total;

    perSolution.push({
      label: sol.label || 'Solución',
      passed: result.passed || 0,
      total: result.total || 0,
      fullyPassed,
      error: result.error || null,
    });

    if (anyFullyPassed) break;
  }

  return {
    success: true,
    passed: bestPassed,
    total: bestTotal,
    results: perSolution,
    _isCorrect: anyFullyPassed,
  };
}

export function evaluateMultipleChoice(userAnswer, correctOption) {
  const u = parseInt(userAnswer, 10);
  const passed = Number.isFinite(u) && u === correctOption;
  return {
    success: true,
    passed: passed ? 1 : 0,
    total: 1,
    results: [{
      passed,
      actual: Number.isFinite(u) ? u : null,
    }],
  };
}
