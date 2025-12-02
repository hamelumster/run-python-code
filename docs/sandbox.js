// elements
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const clearCodeBtn = document.getElementById('clearCodeBtn');
const clearOutBtn = document.getElementById('clearOutBtn');
const outputEl = document.getElementById('output');
const stopBtn  = document.getElementById('stopBtn');

let editor;

// ---------- output ----------
function appendOut(text){
  const normalized = String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '');
  outputEl.textContent += normalized;
  outputEl.scrollTop = outputEl.scrollHeight;
}
function clearOutput(){ outputEl.textContent = ""; }

// ---------- Web Worker с Pyodide ----------
let worker = null;
let workerReady = false;

function createWorker(){
  worker = new Worker('./py_worker.js');
  workerReady = false;

  worker.onmessage = (e) => {
    const { type, data, message } = e.data || {};
    switch (type) {
      case 'ready':
        workerReady = true;
        break;
      case 'stdout':
      case 'stderr': {
        const chunk = typeof data === 'string' ? data : String(data);
        appendOut(chunk.endsWith('\n') ? chunk : chunk + '\n');
        break;
      }
      case 'error':
        appendOut(`\nTraceback: ${message}\n`);
        cleanupRunState();
        break;
      case 'done':
        cleanupRunState();
        break;
    }
  };

  // pyodide in worker init
  worker.postMessage({ type: 'init' });
}

function terminateWorker(){
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }
}

function cleanupRunState(){
  stopBtn.disabled = true;
  runBtn.disabled  = false;
}

// ---------- init ----------
window.addEventListener('DOMContentLoaded', () => {
  editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
    mode: 'python',
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    smartIndent: true,
    electricChars: true,
    value: "",
    autoCloseBrackets: true,                  // (1) автозакрытие "(" -> ")"
    extraKeys: {                              // (3) toggle comment + автодополнение по Ctrl-Space
      "Ctrl-/": "toggleComment",
      "Cmd-/": "toggleComment",
      "Ctrl-Space": "autocomplete"
    },
  });
  editor.setValue("");

  const basePad = 12;
  const heightForLines = n => (editor.defaultTextHeight() * n + basePad);

  function resizeToContent(){
    const lines = Math.max(1, editor.lineCount());
    editor.setSize(null, heightForLines(lines));
  }
  resizeToContent();
  editor.on('change', resizeToContent);

// --- tiny autocomplete like Jupyter: suggest "print" on "pr", etc.
const PY_WORDS = [
  "print","input","len","range","int","str","float","list","dict","set","tuple",
  "for","while","if","elif","else","def","class","return","yield",
  "import","from","as","with","try","except","finally","True","False","None"
];

// провайдер подсказок
function pythonTinyHint(cm) {
  const cur   = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const start = token.start;
  const end   = cur.ch;
  const from  = CodeMirror.Pos(cur.line, start);
  const to    = CodeMirror.Pos(cur.line, end);

  const typed = token.string.slice(0, end - start);
  // показываем слова, начинающиеся с того, что уже набрано
  let list = PY_WORDS.filter(w => w.startsWith(typed) && w !== typed);

  // приоритет "print" — сверху (чтобы Enter сразу его взял)
  list.sort((a,b) => (a==="print" ? -1 : b==="print" ? 1 : a.localeCompare(b)));

  return { list, from, to };
}

// автопоказ, когда символов в слове >= 2 (например "pr")
editor.on('inputRead', (cm, change) => {
  if (!change.text || !change.text[0]) return;
  if (!/[\w_]/.test(change.text[0])) return;
  const cur   = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const len   = cur.ch - token.start;
  if (len >= 2) {
    cm.showHint({
      hint: pythonTinyHint,
      completeSingle: false,
      closeCharacters: /(?:)/
    });
  }
});

  // create worker at start
  createWorker();

  // buttons
  runBtn.addEventListener('click', runCode);
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(editor.getValue());
  });
  clearCodeBtn.addEventListener('click', () => {
    editor.setValue("");
    resizeToContent();
  });
  clearOutBtn.addEventListener('click', clearOutput);

  // stop: kill worker and create new
  stopBtn.addEventListener('click', () => {
    terminateWorker();
    appendOut('\n[Выполнение остановлено]\n');
    cleanupRunState();
    createWorker(); // clear interprener for next run
  });
});

// ---------- run ----------
async function runCode(){
  clearOutput();

  // if no worker - create
  if (!worker) createWorker();

  // waiting pyodide in worker
  const waitReady = () => new Promise(resolve => {
    if (workerReady) return resolve();
    const iv = setInterval(() => {
      if (workerReady) { clearInterval(iv); resolve(); }
    }, 30);
  });
  await waitReady();

  // stages
  stopBtn.disabled = false;
  runBtn.disabled  = true;

  // code to worker
  worker.postMessage({ type: 'run', code: editor.getValue() });
}
