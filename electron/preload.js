const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onNewTab: (callback) => ipcRenderer.on('new-tab', callback),
  onImportData: (callback) => ipcRenderer.on('import-request-data', (event, data) => callback(data)),
  onTriggerExport: (callback) => ipcRenderer.on('trigger-export', callback),
  saveFile: (data, defaultName) => ipcRenderer.invoke('save-file', data, defaultName)
});
