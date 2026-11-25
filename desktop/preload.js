// The only bridge between the app and the computer: three secure-storage calls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('daftarDesktop', {
  secureGet: (key) => ipcRenderer.invoke('secure:get', key),
  secureSet: (key, value) => ipcRenderer.invoke('secure:set', key, value),
  secureDelete: (key) => ipcRenderer.invoke('secure:delete', key),
});
