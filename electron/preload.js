'use strict';
// 렌더러에 노출되는 데스크톱 API — js/save.js(SaveStore)와 js/desktop.js가 사용한다.
// 저장 관련은 sendSync: 부팅 시 동기 로드가 필요하고, 쓰기는 200ms 디바운스라
// 호출 빈도가 낮아 블로킹 비용이 무시할 수준이며 종료 직전 유실이 없다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  loadDataSync: (section) => ipcRenderer.sendSync('save-load-sync', section),
  saveData: (section, json) => ipcRenderer.sendSync('save-write-sync', section, json),
  deleteData: (section) => ipcRenderer.sendSync('save-delete-sync', section),
  steamAvailable: () => ipcRenderer.sendSync('steam-available-sync'),
  unlockAchievement: (name) => ipcRenderer.send('steam-unlock-ach', name),
  quit: () => ipcRenderer.send('app-quit'),
  setFullscreen: (on) => ipcRenderer.send('set-fullscreen', on),
  isFullscreen: () => ipcRenderer.sendSync('get-fullscreen-sync'),
});
