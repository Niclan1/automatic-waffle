const { contextBridge, ipcRenderer } = require('electron');
const allowed = new Set(['save_content', 'read_content', 'delete_content', 'export_content', 'open_release', 'open_official']);
contextBridge.exposeInMainWorld('desktop', { invoke: (command, args) => {
  if (!allowed.has(command)) return Promise.reject(new Error('Unknown command'));
  return ipcRenderer.invoke(command, args);
} });
