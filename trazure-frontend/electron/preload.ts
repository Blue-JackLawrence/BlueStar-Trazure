import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data: any) => ipcRenderer.invoke('save-file', data),
  getFile: (data: any) => ipcRenderer.invoke('get-file', data),
  deleteFile: (data: any) => ipcRenderer.invoke('delete-file', data),

  // ✨ 新增能力
  getCurrentStoragePath: () => ipcRenderer.invoke('get-current-storage-path'),
  changeStoragePath: () => ipcRenderer.invoke('change-storage-path')
})
