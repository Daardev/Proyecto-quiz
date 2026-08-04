import { evaluateMarkup } from '../services/sandbox.service.js';

const BUTTON_CODE = `<button onclick="handleButton()" style="padding: 10px 20px; border-radius: 8px; cursor: pointer;" onmouseover="this.title='clickear';">enviar</button>`;

const BUTTON_TESTS = [
  { input: '', check: 'hasElement', selector: 'button', expected: true },
  { input: '', check: 'elementText', selector: 'button', expected: 'enviar' },
  { input: '', check: 'hasAttribute', selector: 'button', attribute: 'onclick', expected: 'handleButton' },
  { input: '', check: 'hasStyle', selector: 'button', property: 'border-radius', valueContains: '8px' },
  { input: '', check: 'hasStyle', selector: 'button', property: 'cursor', valueContains: 'pointer' },
];

const result = evaluateMarkup(BUTTON_CODE, BUTTON_TESTS);
console.log(`Button test: ${result.passed}/${result.total} passed`);
result.results.forEach((r, i) => console.log(`  ${r.passed ? '✓' : '✗'} ${BUTTON_TESTS[i].check}`));
