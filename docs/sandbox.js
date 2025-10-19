// elements
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const clearCodeBtn = document.getElementById('clearCodeBtn');
const clearOutBtn = document.getElementById('clearOutBtn');
const outputEl = document.getElementById('output');
const stopBtn  = document.getElementById('stopBtn');

let pyodide, editor, abortController = null;

// output
function appendOut(text){
  outputEl.textContent += text;
  outputEl.scrollTop = outputEl.scrollHeight;
}
function clearOutput(){ outputEl.textContent = ""; }

// pyodide
async function ensurePyodide(){
  if(!pyodide){
    pyodide = await loadPyodide();
    pyodide.setStdout({ batched:s => appendOut(s) });
    pyodide.setStderr({ batched:s => appendOut(s) });
  }
  return pyodide;
}

// — initialization, redactor setup, auto-resize
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
  stopBtn.addEventListener('click', () => {
  if (abortController) abortController.abort();
    });
});

// run code
async function runCode(){
  clearOutput();
  try{
    await ensurePyodide();
    const code = editor.getValue();

    // Stop - block run
    stopBtn.disabled = false;
    runBtn.disabled  = true;

    abortController = new AbortController();
    const signal = abortController.signal;

    await pyodide.runPythonAsync(code, { signal });
  }catch(e){
    if (e?.name === 'AbortError'){
      appendOut('\n[Выполнение остановлено]\n');
    } else {
      appendOut(`\nTraceback: ${e.message || e}\n`);
    }
  }finally{
    stopBtn.disabled = true;
    runBtn.disabled  = false;
    abortController = null;
  }
}
