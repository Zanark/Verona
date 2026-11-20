const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("veronaDesktop", {
  agentEnabled: process.argv.includes("--verona-agent"),
  agentReady: () => ipcRenderer.invoke("verona:agent-ready"),
  agentResult: (value) => ipcRenderer.invoke("verona:agent-result", value),
  agentAppearance: (value) => ipcRenderer.invoke("verona:agent-appearance", value),
  agentControls: (value) => ipcRenderer.invoke("verona:agent-controls", value),
  onAgent: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on("verona:agent", handler);
    return () => ipcRenderer.removeListener("verona:agent", handler);
  },
  command: (action, value) => ipcRenderer.invoke("verona:command", action, value),
  onCursor: (callback) => {
    const handler = (_event, position) => callback(position);
    ipcRenderer.on("verona:cursor", handler);
    return () => ipcRenderer.removeListener("verona:cursor", handler);
  },
  onMode: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("verona:mode", handler);
    return () => ipcRenderer.removeListener("verona:mode", handler);
  },
});
