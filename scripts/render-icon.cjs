// Gera build/icon.png (512x512) a partir de build/icon.svg usando o próprio Electron.
// Uso: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../build/icon.svg'), 'utf8')
  const win = new BrowserWindow({
    width: 512, height: 512, show: false, transparent: true, frame: false,
    useContentSize: true, webPreferences: { offscreen: true }
  })
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const out = path.join(__dirname, '../build/icon.png')
  fs.writeFileSync(out, img.resize({ width: 512, height: 512 }).toPNG())
  console.log('ok', out, img.getSize())
  app.quit()
})
