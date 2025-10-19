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
    value: "",
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
