import { contextBridge, ipcRenderer } from 'electron';

require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
contextBridge.exposeInMainWorld('electronAPI', {
  updateTitleBarTheme: (theme: string) => {
    try {
      ipcRenderer.send('update-titlebar-theme', { theme });
    } catch (e) {
      console.error('Error in updateTitleBarTheme IPC:', e);
    }
  },
  isElectron: true,
});

