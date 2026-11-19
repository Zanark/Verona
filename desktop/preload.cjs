const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("veronaDesktop", {
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
