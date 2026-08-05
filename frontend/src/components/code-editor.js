const MONACO_VERSION = '0.44.0';
const MONACO_LOADER_URL = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min/vs/loader.min.js`;
const MONACO_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min/vs`;
const MONACO_PARENT_URL = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min`;

const MONACO_LANGUAGE_MAP = {
  javascript: 'javascript',
  typescript: 'typescript',
  'js-avanzado': 'javascript',
  node: 'javascript',
  python: 'python',
  java: 'java',
  'c': 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  markdown: 'markdown',
  sql: 'sql',
  postgresql: 'sql',
  'html-css-js': 'html',
  shell: 'shell',
  bash: 'shell',
  powershell: 'powershell',
  dockerfile: 'dockerfile',
  plaintext: 'plaintext',
  text: 'plaintext',
};

function resolveMonacoLanguage(language) {
  const key = (language || '').toLowerCase();
  return MONACO_LANGUAGE_MAP[key] || 'plaintext';
}

function setupMonacoEnvironment() {
  if (window.MonacoEnvironment) return;
  window.MonacoEnvironment = {
    getWorkerUrl: function () {
      const workerScriptUrl = `${MONACO_BASE_URL}/base/worker/workerMain.js`;
      const proxyCode = `self.MonacoEnvironment = { baseUrl: '${MONACO_PARENT_URL}/' };\nimportScripts('${workerScriptUrl}');`;
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(proxyCode)}`;
    },
  };
}

let loaderPromise = null;

function loadMonacoLoader() {
  if (window.monaco) return Promise.resolve(window.monaco);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MONACO_LOADER_URL;
    script.onload = () => {
      window.require.config({ paths: { vs: MONACO_BASE_URL } });
      setupMonacoEnvironment();
      window.require(['vs/editor/editor.main'], () => {
        resolve(window.monaco);
      });
    };
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('No se pudo cargar Monaco Editor desde CDN'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export class CodeEditor {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    if (!this.container) {
      throw new Error(`CodeEditor: container "${containerId}" no encontrado`);
    }
    this.options = {
      language: options.language || 'javascript',
      theme: options.theme || 'vs-dark',
      value: options.value || '',
      fontSize: options.fontSize || 14,
      readOnly: options.readOnly === true,
      ...options,
    };
    this.editor = null;
  }

  async init() {
    const monaco = await loadMonacoLoader();
    const monacoLang = resolveMonacoLanguage(this.options.language);
    const readOnly = this.options.readOnly === true;
    this.editor = monaco.editor.create(this.container, {
      value: this.options.value,
      language: monacoLang,
      theme: this.options.theme,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: this.options.fontSize,
      lineHeight: 20,
      wordWrap: 'on',
      domReadOnly: readOnly,
      readOnly,
      contextmenu: readOnly,
      renderLineHighlight: readOnly ? 'none' : 'line',
      cursorBlinking: readOnly ? 'solid' : 'blink',
      cursorStyle: readOnly ? 'underline' : 'line',
    });
    return this.editor;
  }

  getValue() {
    return this.editor ? this.editor.getValue() : '';
  }

  setValue(code) {
    if (this.editor) this.editor.setValue(code);
  }

  destroy() {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
}