import { create } from 'zustand'
import type { AppData, Auth, Collection, Environment, HttpResponse, KeyValue, RequestItem } from '../../shared/types'
import { activeVars, resolveCollectionVars, resolveRequest } from './vars'
import { importJson } from './importers'
import { buildExport, datedName } from './exporters'

export interface ImportSummary {
  files: { name: string; ok: boolean; detail: string }[]
  collections: string[]
  environments: string[]
  requestCount: number
  warnings: string[]
}
export type ImportDialog = { stage: 'intro' } | { stage: 'busy' } | { stage: 'result'; summary: ImportSummary }
/** Janela "Exportar tudo": escolhe opções e depois mostra onde salvou */
export type ExportDialog = { stage: 'options' } | { stage: 'done'; path: string; removeSecrets: boolean }
import {
  cloneCollectionWithNewIds,
  cloneWithNewIds,
  contains,
  findContainer,
  locate,
  DEFAULT_COLLECTION_NAME,
  newCollection,
  newFolder,
  newRequest,
  uid
} from './tree'

export interface CollectionDraft {
  name: string
  auth: Auth
  headers: KeyValue[]
}

interface TabBase {
  id: string // id do item ou da coleção
  dirty: boolean
}
export interface RequestTab extends TabBase {
  kind: 'request'
  draft: RequestItem
  response?: HttpResponse
  sending: boolean
  runId?: string
}
export interface CollectionTab extends TabBase {
  kind: 'collection'
  draft: CollectionDraft
}
/** Aba única de gerenciamento de ambientes (sem rascunho: edita direto e salva sozinho) */
export interface EnvironmentsTab extends TabBase {
  kind: 'environments'
  draft: { name: string }
}
export const ENVIRONMENTS_TAB_ID = '__environments'
export type Tab = RequestTab | CollectionTab | EnvironmentsTab

interface State {
  loaded: boolean
  data: AppData
  tabs: Tab[]
  activeTabId: string | null
  expanded: Record<string, boolean>
  renamingId: string | null
  theme: Theme

  toggleTheme(): void
  /** Cria uma requisição avulsa na coleção genérica "Sem coleção" (criada se não existir). */
  addLooseRequest(): void
  init(): Promise<void>
  mutate(fn: (d: AppData) => void): void

  addCollection(): void
  importDialog: ImportDialog | null
  openImport(): void
  closeImport(): void
  /** Escolhe arquivos .json (Postman ou Chamadinhas) e importa coleções e ambientes */
  runImport(): Promise<void>
  exportCollection(id: string): Promise<void>
  exportDialog: ExportDialog | null
  openExport(): void
  closeExport(): void
  /** Exporta todas as coleções e ambientes num único .json (opcionalmente sem segredos) */
  runExport(removeSecrets: boolean): Promise<void>
  exportEnvironment(id: string): Promise<string | null>
  /** Reordena coleções: solta dragId antes/depois de targetId */
  moveCollection(dragId: string, targetId: string, position: 'before' | 'after'): void
  moveCollectionBy(id: string, delta: -1 | 1): void
  addRequest(containerId: string): void
  addFolder(containerId: string): void
  rename(id: string, name: string): void
  duplicate(id: string): void
  remove(id: string): void
  move(dragId: string, targetId: string, position: 'inside' | 'before'): void
  toggleExpanded(id: string, value?: boolean): void
  setRenaming(id: string | null): void

  openRequest(id: string): void
  openCollectionSettings(id: string): void
  closeTab(id: string): void
  setActive(id: string): void
  updateRequestDraft(id: string, patch: Partial<RequestItem>): void
  updateCollectionDraft(id: string, patch: Partial<CollectionDraft>): void
  saveTab(id: string): void
  send(id: string): Promise<void>
  cancel(id: string): void

  // ambientes
  openEnvironments(): void
  addEnvironment(): string
  updateEnvironment(id: string, patch: Partial<Omit<Environment, 'id'>>): void
  duplicateEnvironment(id: string): string | null
  removeEnvironment(id: string): boolean
  setActiveEnvironment(id: string | null): void
}

export type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'light' // Terraform Theme claro é o padrão
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<State>((set, get) => ({
  loaded: false,
  data: { version: 1, collections: [] },
  tabs: [],
  activeTabId: null,
  expanded: JSON.parse(localStorage.getItem('expanded') ?? '{}'),
  renamingId: null,
  theme: initialTheme(),
  importDialog: null,
  exportDialog: null,

  toggleTheme() {
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' }))
  },

  addLooseRequest() {
    let def = get().data.collections.find((c) => c.isDefault)
    if (!def) {
      def = { ...newCollection(DEFAULT_COLLECTION_NAME), isDefault: true }
      const created = def
      get().mutate((d) => d.collections.unshift(created))
    }
    get().addRequest(def.id)
  },

  async init() {
    const data = await window.api.loadData()
    // arquivos antigos não têm ambientes: completa sem tocar no resto
    data.environments ??= []
    data.activeEnvironmentId ??= null
    set({ data, loaded: true })
  },

  mutate(fn) {
    const data = structuredClone(get().data)
    fn(data)
    set({ data })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      window.api.saveData(get().data)
    }, 300)
  },

  addCollection() {
    const c = newCollection()
    get().mutate((d) => d.collections.push(c))
    set((s) => ({ expanded: { ...s.expanded, [c.id]: true }, renamingId: c.id }))
  },

  openImport() {
    set({ importDialog: { stage: 'intro' } })
  },

  closeImport() {
    set({ importDialog: null })
  },

  async runImport() {
    const files = await window.api.pickImportFiles()
    if (!files.length) return
    set({ importDialog: { stage: 'busy' } })
    const summary: ImportSummary = { files: [], collections: [], environments: [], requestCount: 0, warnings: [] }
    const newCollections: Collection[] = []
    const newEnvironments: Environment[] = []

    for (const file of files) {
      try {
        const r = importJson(file.name, JSON.parse(file.text))
        newCollections.push(...r.collections)
        newEnvironments.push(...r.environments)
        summary.requestCount += r.requestCount
        summary.warnings.push(...r.warnings)
        const parts = [
          r.collections.length && `${r.collections.length} coleção(ões), ${r.requestCount} requisição(ões)`,
          r.environments.length && `${r.environments.length} ambiente(s)`
        ].filter(Boolean)
        summary.files.push({ name: file.name, ok: true, detail: parts.join(' · ') || 'nada para importar' })
      } catch (e) {
        const msg = e instanceof SyntaxError ? 'não é um JSON válido' : e instanceof Error ? e.message : String(e)
        summary.files.push({ name: file.name, ok: false, detail: msg })
      }
    }

    summary.collections = newCollections.map((c) => c.name)
    summary.environments = newEnvironments.map((e) => e.name)
    if (newCollections.length || newEnvironments.length) {
      // só pode haver uma "Sem coleção": a importada vira coleção comum se já existir uma aqui
      let hasDefault = get().data.collections.some((c) => c.isDefault)
      for (const c of newCollections) {
        if (c.isDefault && hasDefault) delete c.isDefault
        else if (c.isDefault) hasDefault = true
      }
      get().mutate((d) => {
        d.collections.push(...newCollections)
        d.environments = [...(d.environments ?? []), ...newEnvironments]
      })
      set((s) => ({
        expanded: { ...s.expanded, ...Object.fromEntries(newCollections.map((c) => [c.id, true])) }
      }))
    }
    set({ importDialog: { stage: 'result', summary } })
  },

  async exportCollection(id) {
    const c = get().data.collections.find((c) => c.id === id)
    if (c)
      await window.api.saveJsonFile('Exportar coleção', `${c.name}.chamadinhas.json`, {
        chamadinhasCollection: 1,
        collection: c
      })
  },

  openExport() {
    set({ exportDialog: { stage: 'options' } })
  },

  closeExport() {
    set({ exportDialog: null })
  },

  async runExport(removeSecrets) {
    const { data } = get()
    const file = buildExport(data.collections, data.environments ?? [], removeSecrets)
    const path = await window.api.saveJsonFile('Exportar tudo', datedName('chamadinhas'), file)
    if (path) set({ exportDialog: { stage: 'done', path, removeSecrets } })
  },

  async exportEnvironment(id) {
    const env = get().data.environments?.find((e) => e.id === id)
    if (!env) return null
    const file = buildExport([], [env], false)
    return window.api.saveJsonFile('Exportar ambiente', `${env.name}.ambiente.json`, file)
  },

  moveCollection(dragId, targetId, position) {
    if (dragId === targetId) return
    get().mutate((d) => {
      const from = d.collections.findIndex((c) => c.id === dragId)
      if (from < 0 || !d.collections.some((c) => c.id === targetId)) return
      const [c] = d.collections.splice(from, 1)
      const to = d.collections.findIndex((x) => x.id === targetId)
      d.collections.splice(position === 'before' ? to : to + 1, 0, c)
    })
  },

  moveCollectionBy(id, delta) {
    const list = get().data.collections
    const i = list.findIndex((c) => c.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= list.length) return
    get().moveCollection(id, list[j].id, delta < 0 ? 'before' : 'after')
  },

  addRequest(containerId) {
    const r = newRequest()
    get().mutate((d) => findContainer(d.collections, containerId)?.items.push(r))
    set((s) => ({ expanded: { ...s.expanded, [containerId]: true }, renamingId: r.id }))
    get().openRequest(r.id)
  },

  addFolder(containerId) {
    const f = newFolder()
    get().mutate((d) => findContainer(d.collections, containerId)?.items.push(f))
    set((s) => ({ expanded: { ...s.expanded, [containerId]: true, [f.id]: true }, renamingId: f.id }))
  },

  rename(id, name) {
    name = name.trim()
    set({ renamingId: null })
    if (!name) return
    get().mutate((d) => {
      const c = d.collections.find((c) => c.id === id)
      if (c) c.name = name
      else {
        const l = locate(d.collections, id)
        if (l) l.item.name = name
      }
    })
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? ({ ...t, draft: { ...t.draft, name } } as Tab) : t))
    }))
  },

  duplicate(id) {
    const { data } = get()
    const c = data.collections.find((c) => c.id === id)
    if (c) {
      const copy = cloneCollectionWithNewIds(c)
      copy.name += ' (cópia)'
      get().mutate((d) => d.collections.push(copy))
      return
    }
    const l = locate(data.collections, id)
    if (!l) return
    const copy = cloneWithNewIds(l.item)
    copy.name += ' (cópia)'
    get().mutate((d) => {
      const ll = locate(d.collections, id)!
      ll.parent.items.splice(ll.index + 1, 0, copy)
    })
  },

  remove(id) {
    const { data } = get()
    const c = data.collections.find((c) => c.id === id)
    const l = c ? null : locate(data.collections, id)
    const label = c ? `a coleção "${c.name}"` : l ? `"${l.item.name}"` : null
    if (!label || !confirm(`Excluir ${label}? Essa ação não pode ser desfeita.`)) return
    const isRemoved = (tabId: string): boolean =>
      tabId === id ||
      (c ? !!locate([c], tabId) : l!.item.type === 'folder' && contains(l!.item, tabId))
    get().mutate((d) => {
      if (c) d.collections = d.collections.filter((x) => x.id !== id)
      else {
        const ll = locate(d.collections, id)
        ll?.parent.items.splice(ll.index, 1)
      }
    })
    set((s) => {
      const tabs = s.tabs.filter((t) => !isRemoved(t.id))
      const activeTabId = tabs.some((t) => t.id === s.activeTabId)
        ? s.activeTabId
        : (tabs[tabs.length - 1]?.id ?? null)
      return { tabs, activeTabId }
    })
  },

  move(dragId, targetId, position) {
    if (dragId === targetId) return
    const { data } = get()
    const dragged = locate(data.collections, dragId)
    if (!dragged) return
    if (contains(dragged.item, targetId)) return // não mover pasta para dentro dela mesma
    get().mutate((d) => {
      const src = locate(d.collections, dragId)!
      src.parent.items.splice(src.index, 1)
      if (position === 'inside') {
        findContainer(d.collections, targetId)?.items.push(src.item)
      } else {
        const tgt = locate(d.collections, targetId)
        if (tgt) tgt.parent.items.splice(tgt.index, 0, src.item)
        else src.parent.items.splice(src.index, 0, src.item)
      }
    })
    if (position === 'inside') set((s) => ({ expanded: { ...s.expanded, [targetId]: true } }))
  },

  toggleExpanded(id, value) {
    set((s) => ({ expanded: { ...s.expanded, [id]: value ?? !s.expanded[id] } }))
  },

  setRenaming(id) {
    set({ renamingId: id })
  },

  openRequest(id) {
    const { tabs, data } = get()
    if (!tabs.some((t) => t.id === id)) {
      const l = locate(data.collections, id)
      if (!l || l.item.type !== 'request') return
      const tab: RequestTab = { kind: 'request', id, dirty: false, sending: false, draft: structuredClone(l.item) }
      set({ tabs: [...tabs, tab] })
    }
    set({ activeTabId: id })
  },

  openCollectionSettings(id) {
    const { tabs, data } = get()
    if (!tabs.some((t) => t.id === id)) {
      const c = data.collections.find((c) => c.id === id)
      if (!c) return
      const tab: CollectionTab = {
        kind: 'collection',
        id,
        dirty: false,
        draft: structuredClone({ name: c.name, auth: c.auth, headers: c.headers })
      }
      set({ tabs: [...tabs, tab] })
    }
    set({ activeTabId: id })
  },

  closeTab(id) {
    const { tabs, activeTabId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx < 0) return
    const tab = tabs[idx]
    if (tab.dirty && !confirm(`"${tab.draft.name}" tem alterações não salvas. Fechar mesmo assim?`)) return
    if (tab.kind === 'request' && tab.runId) window.api.cancel(tab.runId)
    const next = tabs.filter((t) => t.id !== id)
    set({
      tabs: next,
      activeTabId: activeTabId === id ? (next[Math.min(idx, next.length - 1)]?.id ?? null) : activeTabId
    })
  },

  setActive(id) {
    set({ activeTabId: id })
  },

  updateRequestDraft(id, patch) {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id && t.kind === 'request' ? { ...t, dirty: true, draft: { ...t.draft, ...patch } } : t
      )
    }))
  },

  updateCollectionDraft(id, patch) {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id && t.kind === 'collection' ? { ...t, dirty: true, draft: { ...t.draft, ...patch } } : t
      )
    }))
  },

  saveTab(id) {
    const tab = get().tabs.find((t) => t.id === id)
    if (!tab) return
    get().mutate((d) => {
      if (tab.kind === 'environments') return
      if (tab.kind === 'request') {
        const l = locate(d.collections, id)
        if (l) l.parent.items[l.index] = structuredClone(tab.draft)
      } else {
        const c = d.collections.find((c) => c.id === id)
        if (c) Object.assign(c, structuredClone(tab.draft))
      }
    })
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, dirty: false } : t)) }))
  },

  async send(id) {
    const tab = get().tabs.find((t) => t.id === id)
    if (!tab || tab.kind !== 'request' || tab.sending) return
    if (!tab.draft.url.trim()) return
    // aplica as {{variáveis}} do ambiente ativo antes de montar a requisição
    const vars = activeVars(get().data)
    const rawCollection = locate(get().data.collections, id)?.collection
    const collection = rawCollection && resolveCollectionVars(rawCollection, vars)
    const r = resolveRequest(tab.draft, vars)
    const runId = uid()
    const patchTab = (p: Partial<RequestTab>): void =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === id && t.kind === 'request' ? { ...t, ...p } : t)) }))

    // headers: coleção primeiro, requisição sobrescreve (case-insensitive)
    const headerMap = new Map<string, [string, string]>()
    for (const h of [...(collection?.headers ?? []), ...r.headers]) {
      if (h.enabled && h.key.trim()) headerMap.set(h.key.trim().toLowerCase(), [h.key.trim(), h.value])
    }
    let url = r.url.trim()
    const auth = r.auth.type === 'inherit' ? (collection?.auth ?? { type: 'none' }) : r.auth
    const setIfAbsent = (k: string, v: string): void => {
      if (!headerMap.has(k.toLowerCase())) headerMap.set(k.toLowerCase(), [k, v])
    }
    if (auth.type === 'bearer' && auth.token) setIfAbsent('Authorization', `Bearer ${auth.token}`)
    if (auth.type === 'basic') {
      const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`)
      setIfAbsent('Authorization', 'Basic ' + btoa(String.fromCharCode(...bytes)))
    }
    if (auth.type === 'apikey' && auth.key) {
      if (auth.addTo === 'header') setIfAbsent(auth.key, auth.value)
      else
        url +=
          (url.includes('?') ? '&' : '?') +
          encodeURIComponent(auth.key) +
          '=' +
          encodeURIComponent(auth.value)
    }

    setIfAbsent('User-Agent', 'Chamadinhas/1.0')

    patchTab({ sending: true, runId })
    const response = await window.api.send({
      requestId: runId,
      method: r.method,
      url,
      headers: [...headerMap.values()],
      body: r.body,
      timeoutMs: 60_000
    })
    patchTab({ sending: false, runId: undefined, response })
  },

  cancel(id) {
    const tab = get().tabs.find((t) => t.id === id)
    if (tab?.kind === 'request' && tab.runId) window.api.cancel(tab.runId)
  },

  openEnvironments() {
    const { tabs } = get()
    if (!tabs.some((t) => t.id === ENVIRONMENTS_TAB_ID)) {
      const tab: EnvironmentsTab = { kind: 'environments', id: ENVIRONMENTS_TAB_ID, dirty: false, draft: { name: 'Ambientes' } }
      set({ tabs: [...tabs, tab] })
    }
    set({ activeTabId: ENVIRONMENTS_TAB_ID })
  },

  addEnvironment() {
    const env: Environment = { id: uid(), name: 'Novo ambiente', variables: [] }
    get().mutate((d) => {
      d.environments = [...(d.environments ?? []), env]
      // o primeiro ambiente criado já fica ativo
      if (!d.activeEnvironmentId) d.activeEnvironmentId = env.id
    })
    return env.id
  },

  updateEnvironment(id, patch) {
    get().mutate((d) => {
      const e = d.environments?.find((x) => x.id === id)
      if (e) Object.assign(e, patch)
    })
  },

  duplicateEnvironment(id) {
    const src = get().data.environments?.find((e) => e.id === id)
    if (!src) return null
    const copy: Environment = {
      id: uid(),
      name: src.name + ' (cópia)',
      variables: src.variables.map((v) => ({ ...v, id: uid() }))
    }
    get().mutate((d) => {
      const list = d.environments ?? []
      list.splice(list.findIndex((e) => e.id === id) + 1, 0, copy)
      d.environments = list
    })
    return copy.id
  },

  removeEnvironment(id) {
    const env = get().data.environments?.find((e) => e.id === id)
    if (!env || !confirm(`Excluir o ambiente "${env.name}" e suas variáveis? Essa ação não pode ser desfeita.`)) return false
    get().mutate((d) => {
      d.environments = (d.environments ?? []).filter((e) => e.id !== id)
      if (d.activeEnvironmentId === id) d.activeEnvironmentId = null
    })
    return true
  },

  setActiveEnvironment(id) {
    get().mutate((d) => {
      d.activeEnvironmentId = id
    })
  }
}))

// lembra pastas/coleções abertas entre execuções
useStore.subscribe((s, prev) => {
  if (s.expanded !== prev.expanded) localStorage.setItem('expanded', JSON.stringify(s.expanded))
})

// aplica o tema (claro/escuro) no documento e avisa o processo main (cor de fundo da janela)
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
  window.api.setTheme(theme)
}
applyTheme(useStore.getState().theme)
useStore.subscribe((s, prev) => {
  if (s.theme !== prev.theme) applyTheme(s.theme)
})

/** Grava imediatamente qualquer alteração pendente do autosave. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    await window.api.saveData(useStore.getState().data)
  }
}

export function resolveCollection(id: string): Collection | undefined {
  return locate(useStore.getState().data.collections, id)?.collection
}
