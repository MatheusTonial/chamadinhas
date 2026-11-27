import { app } from 'electron'
import { promises as fs, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import type { AppData } from '../shared/types'

const dataFile = (): string => join(app.getPath('userData'), 'data.json')

const empty = (): AppData => ({ version: 1, collections: [] })

/**
 * O app se chamava "ApiClient" e guardava os dados em %APPDATA%\ApiClient.
 * Na primeira execução como "Chamadinhas", copia (sem apagar a origem) os dados antigos.
 */
export function migrateFromOldName(): void {
  const newDir = app.getPath('userData')
  if (existsSync(join(newDir, 'data.json'))) return
  const oldDir = join(app.getPath('appData'), 'ApiClient')
  if (!existsSync(join(oldDir, 'data.json'))) return
  mkdirSync(newDir, { recursive: true })
  for (const f of ['data.json', 'data.json.bak', 'prefs.json']) {
    const src = join(oldDir, f)
    if (existsSync(src)) copyFileSync(src, join(newDir, f))
  }
}

export async function loadData(): Promise<AppData> {
  const file = dataFile()
  for (const candidate of [file, file + '.bak']) {
    if (!existsSync(candidate)) continue
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, 'utf-8'))
      if (parsed && Array.isArray(parsed.collections)) return parsed as AppData
    } catch {
      // arquivo corrompido: tenta o backup
    }
  }
  return empty()
}

let writing: Promise<void> = Promise.resolve()

export function saveData(data: AppData): Promise<void> {
  // serializa as gravações para não sobrepor
  writing = writing.then(async () => {
    const file = dataFile()
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    const tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    if (existsSync(file)) await fs.copyFile(file, file + '.bak')
    await fs.rename(tmp, file)
  })
  return writing
}
