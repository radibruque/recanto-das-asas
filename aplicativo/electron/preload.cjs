// Minimal, explicit bridge for the Windows app. No Node APIs are exposed to the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recantoDesktop', {
  scheduleNotifications: (items) => ipcRenderer.invoke('recanto:schedule-notifications', Array.isArray(items) ? items.slice(0, 100) : []),
  setKeepInTray: (enabled) => ipcRenderer.invoke('recanto:set-keep-in-tray', enabled === true),
  getKeepInTray: () => ipcRenderer.invoke('recanto:get-keep-in-tray'),
  onOpenTarget: (listener) => { ipcRenderer.on('recanto:open-target', (_event, target) => { if (target && typeof target === 'object') listener(target); }); },
});
