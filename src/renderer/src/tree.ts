import type { Collection, FolderItem, Item, KeyValue, RequestItem } from '../../shared/types'

export const uid = (): string => crypto.randomUUID()

export const kv = (key = '', value = '', enabled = true): KeyValue => ({ id: uid(), enabled, key, value })

export function newRequest(name = 'Nova requisição'): RequestItem {
  return {
    type: 'request',
    id: uid(),
    name,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    auth: { type: 'inherit' },
    body: { mode: 'none', raw: '', fields: [] }
  }
}

export function newFolder(name = 'Nova pasta'): FolderItem {
  return { type: 'folder', id: uid(), name, items: [] }
}

export const DEFAULT_COLLECTION_NAME = 'Sem coleção'

export function newCollection(name = 'Nova coleção'): Collection {
  return { id: uid(), name, auth: { type: 'none' }, headers: [], items: [] }
}

/** Container = coleção ou pasta (algo que tem items). */
export type Container = Collection | FolderItem

export interface Located {
  collection: Collection
  parent: Container
  item: Item
  index: number
}

export function locate(collections: Collection[], id: string): Located | null {
  for (const c of collections) {
    const r = locateIn(c, c, id)
    if (r) return r
  }
  return null
}

function locateIn(collection: Collection, parent: Container, id: string): Located | null {
  for (let i = 0; i < parent.items.length; i++) {
    const it = parent.items[i]
    if (it.id === id) return { collection, parent, item: it, index: i }
    if (it.type === 'folder') {
      const r = locateIn(collection, it, id)
      if (r) return r
    }
  }
  return null
}

export function findContainer(collections: Collection[], id: string): Container | null {
  const c = collections.find((c) => c.id === id)
  if (c) return c
  const l = locate(collections, id)
  return l && l.item.type === 'folder' ? l.item : null
}

/** true se `id` é o próprio item ou está dentro dele. */
export function contains(item: Item, id: string): boolean {
  if (item.id === id) return true
  return item.type === 'folder' && item.items.some((c) => contains(c, id))
}

/** Clona profundamente gerando novos ids. */
export function cloneWithNewIds<T extends Item>(item: T): T {
  const copy = structuredClone(item)
  const walk = (it: Item): void => {
    it.id = uid()
    if (it.type === 'request') {
      ;[...it.params, ...it.headers, ...it.body.fields].forEach((f) => (f.id = uid()))
    } else it.items.forEach(walk)
  }
  walk(copy)
  return copy
}

export function cloneCollectionWithNewIds(c: Collection): Collection {
  const copy = structuredClone(c)
  copy.id = uid()
  delete copy.isDefault
  copy.headers.forEach((h) => (h.id = uid()))
  copy.items = copy.items.map((i) => cloneWithNewIds(i))
  return copy
}

// ---------- URL <-> params ----------

export function parseQuery(url: string): { key: string; value: string }[] {
  const q = url.indexOf('?')
  if (q < 0) return []
  const query = url.slice(q + 1).split('#')[0]
  if (!query) return []
  return query.split('&').map((part) => {
    const eq = part.indexOf('=')
    return eq < 0 ? { key: part, value: '' } : { key: part.slice(0, eq), value: part.slice(eq + 1) }
  })
}

export function urlWithParams(url: string, params: KeyValue[]): string {
  const q = url.indexOf('?')
  const hashIdx = url.indexOf('#', q < 0 ? 0 : q)
  const base = q < 0 ? (hashIdx < 0 ? url : url.slice(0, hashIdx)) : url.slice(0, q)
  const hash = hashIdx < 0 ? '' : url.slice(hashIdx)
  const active = params.filter((p) => p.enabled && (p.key || p.value))
  const qs = active.map((p) => (p.value === '' ? p.key : `${p.key}=${p.value}`)).join('&')
  return base + (qs ? '?' + qs : '') + hash
}

/** Atualiza a tabela de params a partir de uma URL digitada, preservando os desabilitados. */
export function syncParamsFromUrl(url: string, current: KeyValue[]): KeyValue[] {
  const parsed = parseQuery(url)
  const enabled = current.filter((p) => p.enabled)
  const next = parsed.map((p, i) => ({
    id: enabled[i]?.id ?? uid(),
    enabled: true,
    key: p.key,
    value: p.value
  }))
  return [...next, ...current.filter((p) => !p.enabled)]
}

/** Nomes do caminho até o item: [coleção, pasta..., item] */
export function pathNames(collections: Collection[], id: string): string[] {
  const walk = (items: Item[], acc: string[]): string[] | null => {
    for (const it of items) {
      if (it.id === id) return [...acc, it.name]
      if (it.type === 'folder') {
        const r = walk(it.items, [...acc, it.name])
        if (r) return r
      }
    }
    return null
  }
  for (const c of collections) {
    const r = walk(c.items, [c.name])
    if (r) return r
  }
  return []
}
