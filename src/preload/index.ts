import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const api: Api = {
  send: (p) => ipcRenderer.invoke('http:send', p),
  cancel: (id) => ipcRenderer.invoke('http:cancel', id),
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (d) => ipcRenderer.invoke('data:save', d),
  saveJsonFile: (title, defaultName, data) => ipcRenderer.invoke('file:saveJson', title, defaultName, data),
  pickImportFiles: () => ipcRenderer.invoke('import:pick'),
  onCloseRequest: (cb) => {
    ipcRenderer.removeAllListeners('app:close-request')
    ipcRenderer.on('app:close-request', () => cb())
  },
  confirmClose: () => ipcRenderer.invoke('app:close-confirmed'),
  setTheme: (theme) => ipcRenderer.send('theme:set', theme)
}

contextBridge.exposeInMainWorld('api', api)
