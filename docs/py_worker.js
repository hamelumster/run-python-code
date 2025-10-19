// pyodide in worker
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js");

let pyodide = null;

self.onmessage = async (e) => {
  const { type, code } = e.data;

  if (type === "init") {
    try {
      pyodide = await loadPyodide({
        stdout: (s) => self.postMessage({ type: "stdout", data: s }),
        stderr: (s) => self.postMessage({ type: "stderr", data: s }),
      });
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: err?.message || String(err) });
    }
    return;
  }

  if (type === "run") {
    if (!pyodide) {
      self.postMessage({ type: "error", message: "Pyodide not ready" });
      return;
    }
    try {
      await pyodide.runPythonAsync(code);
      self.postMessage({ type: "done" });
    } catch (err) {
      // in main stream
      self.postMessage({ type: "error", message: err?.message || String(err) });
    }
  }
};
