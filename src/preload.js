'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  retry: () => ipcRenderer.send('dsh:retry'),
  openExternal: (url) => ipcRenderer.send('dsh:open-external', url),
});
