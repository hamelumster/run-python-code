// elements
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const clearCodeBtn = document.getElementById('clearCodeBtn');
const clearOutBtn = document.getElementById('clearOutBtn');
const outputEl = document.getElementById('output');

let pyodide, editor;

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

  const basePad = 16;
  const heightForLines = n => (editor.defaultTextHeight() * n + basePad);

  function resizeToContent(){
    const lines = Math.max(10, editor.lineCount());
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
});

// run code
async function runCode(){
  clearOutput();
  try{
    await ensurePyodide();
    const code = editor.getValue();
    await pyodide.runPythonAsync(code);
  }catch(e){
    appendOut(`\nTraceback: ${e.message || e}\n`);
  }
}
