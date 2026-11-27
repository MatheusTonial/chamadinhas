import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { promises as fs, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { cancelRequest, sendRequest } from './http'
import { loadData, migrateFromOldName, saveData } from './storage'
import type { AppData, SendPayload } from '../shared/types'

// cor de fundo da janela por tema (surface do Terraform Theme), evita flash ao abrir
const WINDOW_BG = { light: '#fbfbe2', dark: '#1c1714' } as const
type Theme = keyof typeof WINDOW_BG
const prefsFile = (): string => join(app.getPath('userData'), 'prefs.json')

function readTheme(): Theme {
  try {
    const t = JSON.parse(readFileSync(prefsFile(), 'utf-8')).theme
    return t === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

ipcMain.on('theme:set', (e, theme: Theme) => {
  if (!(theme in WINDOW_BG)) return
  BrowserWindow.fromWebContents(e.sender)?.setBackgroundColor(WINDOW_BG[theme])
  try {
    writeFileSync(prefsFile(), JSON.stringify({ theme }))
  } catch {
    /* ignora */
  }
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: WINDOW_BG[readTheme()],
    title: 'Chamadinhas',
    // no app instalado o ícone vem do .exe; aqui cobre o modo dev
    icon: join(__dirname, '../../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // pergunta ao renderer antes de fechar (salva pendências / avisa abas não salvas)
  let allowClose = false
  win.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    win.webContents.send('app:close-request')
  })
  ipcMain.removeHandler('app:close-confirmed')
  ipcMain.handle('app:close-confirmed', () => {
    allowClose = true
    win.close()
  })

  // log de erros do renderer em userData/app.log (ajuda a diagnosticar o app instalado)
  const logFile = join(app.getPath('userData'), 'app.log')
  const log = (msg: string): void => {
    fs.appendFile(logFile, `[${new Date().toISOString()}] ${msg}\n`).catch(() => {})
  }
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') log(`console ${e.level}: ${e.message} (${e.sourceId}:${e.lineNumber})`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log(`did-fail-load ${code} ${desc} ${url}`))
  win.webContents.on('render-process-gone', (_e, d) => log(`render-process-gone ${d.reason}`))
  win.webContents.on('preload-error', (_e, p, err) => log(`preload-error ${p}: ${err.message}`))

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('http:send', (_e, p: SendPayload) => sendRequest(p))
ipcMain.handle('http:cancel', (_e, id: string) => cancelRequest(id))
ipcMain.handle('data:load', () => loadData())
ipcMain.handle('data:save', (_e, data: AppData) => saveData(data))

// salva um JSON escolhendo o destino (exportar coleção, ambiente ou tudo); devolve o caminho ou null
ipcMain.handle('file:saveJson', async (e, title: string, defaultName: string, data: unknown) => {
  const fileName = defaultName.replace(/[\\/:*?"<>|]/g, '_')
  let filePath: string | undefined
  // só para testes automatizados: grava direto nesta pasta, sem abrir o seletor
  const testDir = process.env.CHAMADINHAS_EXPORT_DIR
  if (testDir) filePath = join(testDir, fileName)
  else {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const r = await dialog.showSaveDialog(win, {
      title,
      defaultPath: join(app.getPath('documents'), fileName),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (r.canceled || !r.filePath) return null
    filePath = r.filePath
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return filePath
})

// escolhe um ou mais .json para importar; a conversão (Postman / formato próprio) é feita no renderer
ipcMain.handle('import:pick', async (e) => {
  // só para testes automatizados: caminhos separados por ";" pulam o seletor de arquivos
  const testFiles = process.env.CHAMADINHAS_IMPORT_FILES
  if (testFiles) {
    return Promise.all(
      testFiles.split(';').map(async (p) => ({ name: basename(p), text: await fs.readFile(p, 'utf-8') }))
    )
  }
  const win = BrowserWindow.fromWebContents(e.sender)!
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Importar coleções e ambientes',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled) return []
  return Promise.all(
    filePaths.map(async (p) => ({ name: basename(p), text: await fs.readFile(p, 'utf-8') }))
  )
})

app.whenReady().then(() => {
  migrateFromOldName()
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
