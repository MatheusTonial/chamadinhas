// Importação de arquivos JSON: formato próprio do Chamadinhas e exportações do Postman
// (coleções v2.0/v2.1, ambientes e globais).
import type {
  Auth,
  Body,
  Collection,
  Environment,
  FolderItem,
  HttpMethod,
  Item,
  KeyValue,
  RequestItem
} from '../../shared/types'
import { cloneCollectionWithNewIds, kv, newCollection, uid } from './tree'

export interface ImportResult {
  collections: Collection[]
  environments: Environment[]
  requestCount: number
  warnings: string[]
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

/** Detecta o formato do arquivo e converte. Lança erro se não reconhecer. */
export function importJson(fileName: string, json: Json): ImportResult {
  if (!json || typeof json !== 'object') throw new Error('o arquivo não contém um objeto JSON')

  // "Exportar tudo" (ou ambiente exportado) do Chamadinhas
  if (json.chamadinhasExport) {
    const collections: Collection[] = (Array.isArray(json.collections) ? json.collections : [])
      .filter((c: Json) => c && typeof c.name === 'string')
      .map((c: Json) => {
        const copy = cloneCollectionWithNewIds({
          ...newCollection(c.name),
          ...c,
          items: Array.isArray(c.items) ? c.items : [],
          headers: c.headers ?? [],
          auth: c.auth ?? { type: 'none' }
        })
        if (c.isDefault) copy.isDefault = true // "Sem coleção"; o store decide se mantém
        return copy
      })
    const environments: Environment[] = (Array.isArray(json.environments) ? json.environments : [])
      .filter((e: Json) => e && typeof e.name === 'string')
      .map((e: Json) => ({
        id: uid(),
        name: e.name,
        variables: (Array.isArray(e.variables) ? e.variables : [])
          .filter((v: Json) => v && typeof v.key === 'string')
          .map((v: Json) => kv(v.key, str(v.value), v.enabled !== false))
      }))
    const warnings = json.secretsRemoved
      ? [`${fileName}: exportado sem segredos — preencha valores das variáveis, tokens e senhas`]
      : []
    return {
      collections,
      environments,
      requestCount: collections.reduce((n, c) => n + countRequests(c.items), 0),
      warnings
    }
  }

  // formato próprio (Chamadinhas / ApiClient)
  const own = json.chamadinhasCollection || json.apiclientCollection ? json.collection : null
  if (own || (typeof json.name === 'string' && Array.isArray(json.items))) {
    const c = own ?? json
    const copy = cloneCollectionWithNewIds({
      ...newCollection(c.name),
      ...c,
      headers: c.headers ?? [],
      auth: c.auth ?? { type: 'none' }
    })
    return { collections: [copy], environments: [], requestCount: countRequests(copy.items), warnings: [] }
  }

  // coleção do Postman
  if (json.info && Array.isArray(json.item)) return importPostmanCollection(json)

  // ambiente ou globais do Postman
  if (Array.isArray(json.values)) {
    const isGlobals = json._postman_variable_scope === 'globals'
    const env: Environment = {
      id: uid(),
      name: json.name || (isGlobals ? 'Globais (Postman)' : fileName.replace(/\.json$/i, '')),
      variables: json.values
        .filter((v: Json) => v && typeof v.key === 'string')
        .map((v: Json) => kv(v.key, str(v.value), v.enabled !== false))
    }
    return { collections: [], environments: [env], requestCount: 0, warnings: [] }
  }

  throw new Error('formato não reconhecido (esperado: coleção ou ambiente do Postman, ou arquivo exportado pelo Chamadinhas)')
}

function importPostmanCollection(json: Json): ImportResult {
  const warnings = new Set<string>()
  const name: string = json.info?.name || 'Coleção importada'
  const ctx = { warnings, collectionName: name }

  const collectionAuth = json.auth ? convertAuth(json.auth, ctx) : null
  const collection: Collection = {
    ...newCollection(name),
    auth: collectionAuth ?? { type: 'none' },
    headers: [],
    items: convertItems(json.item, null, ctx)
  }
  if (hasScripts(json)) warnings.add('scripts (pre-request e tests) foram ignorados')

  // variáveis da coleção viram um ambiente, já que aqui as variáveis ficam nos ambientes
  const environments: Environment[] = []
  const vars = (json.variable ?? []).filter((v: Json) => v && typeof v.key === 'string')
  if (vars.length) {
    environments.push({
      id: uid(),
      name: `${name} (variáveis da coleção)`,
      variables: vars.map((v: Json) => kv(v.key, str(v.value), v.disabled !== true))
    })
  }

  return {
    collections: [collection],
    environments,
    requestCount: countRequests(collection.items),
    warnings: [...warnings].map((w) => `${name}: ${w}`)
  }
}

interface Ctx {
  warnings: Set<string>
  collectionName: string
}

/** inheritedAuth: auth definida numa pasta do Postman (aqui não há auth por pasta, então desce para as requisições) */
function convertItems(items: Json[], inheritedAuth: Auth | null, ctx: Ctx): Item[] {
  const out: Item[] = []
  for (const it of items ?? []) {
    if (!it) continue
    if (Array.isArray(it.item)) {
      const folderAuth = it.auth ? convertAuth(it.auth, ctx) : inheritedAuth
      if (hasScripts(it)) ctx.warnings.add('scripts (pre-request e tests) foram ignorados')
      const folder: FolderItem = {
        type: 'folder',
        id: uid(),
        name: it.name || 'Pasta',
        items: convertItems(it.item, folderAuth, ctx)
      }
      out.push(folder)
    } else if (it.request) {
      if (hasScripts(it)) ctx.warnings.add('scripts (pre-request e tests) foram ignorados')
      out.push(convertRequest(it, inheritedAuth, ctx))
    }
  }
  return out
}

function convertRequest(it: Json, inheritedAuth: Auth | null, ctx: Ctx): RequestItem {
  // v2.x permite request como string (só a URL)
  const req = typeof it.request === 'string' ? { url: it.request, method: 'GET' } : it.request
  const method = String(req.method || 'GET').toUpperCase() as HttpMethod
  if (!METHODS.includes(method)) ctx.warnings.add(`método ${method} não suportado (trocado por GET)`)

  const { url, params } = convertUrl(req.url)
  const headers: KeyValue[] = (Array.isArray(req.header) ? req.header : [])
    .filter((h: Json) => h && typeof h.key === 'string')
    .map((h: Json) => kv(h.key, str(h.value), h.disabled !== true))

  let auth: Auth = { type: 'inherit' }
  if (req.auth && req.auth.type !== 'inherit') auth = convertAuth(req.auth, ctx) ?? { type: 'none' }
  else if (inheritedAuth) auth = structuredClone(inheritedAuth)

  return {
    type: 'request',
    id: uid(),
    name: it.name || url || 'Requisição',
    method: METHODS.includes(method) ? method : 'GET',
    url,
    params,
    headers,
    auth,
    body: convertBody(req.body, ctx)
  }
}

function convertUrl(u: Json): { url: string; params: KeyValue[] } {
  if (!u) return { url: '', params: [] }
  if (typeof u === 'string') return { url: u, params: queryFromRaw(u) }

  let url: string = u.raw ?? ''
  if (!url) {
    const host = Array.isArray(u.host) ? u.host.join('.') : (u.host ?? '')
    const path = Array.isArray(u.path) ? u.path.join('/') : (u.path ?? '')
    url = (u.protocol ? u.protocol + '://' : '') + host + (path ? '/' + path : '')
  }
  const query: Json[] = Array.isArray(u.query) ? u.query : []
  if (!query.length) return { url, params: queryFromRaw(url) }

  const params = query
    .filter((q: Json) => q && (q.key != null || q.value != null))
    .map((q: Json) => kv(str(q.key), str(q.value), q.disabled !== true))
  // garante que a URL tenha exatamente os params habilitados (o raw do Postman às vezes omite)
  const base = url.split('?')[0]
  const qs = params
    .filter((p) => p.enabled)
    .map((p) => (p.value === '' ? p.key : `${p.key}=${p.value}`))
    .join('&')
  return { url: base + (qs ? '?' + qs : ''), params }
}

function queryFromRaw(url: string): KeyValue[] {
  const i = url.indexOf('?')
  if (i < 0) return []
  return url
    .slice(i + 1)
    .split('#')[0]
    .split('&')
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      return eq < 0 ? kv(part, '') : kv(part.slice(0, eq), part.slice(eq + 1))
    })
}

function convertBody(b: Json, ctx: Ctx): Body {
  const empty: Body = { mode: 'none', raw: '', fields: [] }
  if (!b || !b.mode) return empty
  switch (b.mode) {
    case 'raw': {
      const lang = b.options?.raw?.language
      const raw = str(b.raw)
      const looksJson = /^\s*[[{]/.test(raw)
      return { mode: lang === 'json' || (!lang && looksJson) ? 'json' : 'text', raw, fields: [] }
    }
    case 'urlencoded':
      return { mode: 'urlencoded', raw: '', fields: kvList(b.urlencoded) }
    case 'formdata': {
      const list: Json[] = Array.isArray(b.formdata) ? b.formdata : []
      if (list.some((f) => f?.type === 'file')) ctx.warnings.add('campos de arquivo em form-data foram ignorados')
      return { mode: 'formdata', raw: '', fields: kvList(list.filter((f) => f?.type !== 'file')) }
    }
    case 'graphql': {
      ctx.warnings.add('body GraphQL convertido para JSON ({ query, variables })')
      let variables: Json = {}
      try {
        variables = b.graphql?.variables ? JSON.parse(b.graphql.variables) : {}
      } catch {
        variables = {}
      }
      return {
        mode: 'json',
        raw: JSON.stringify({ query: b.graphql?.query ?? '', variables }, null, 2),
        fields: []
      }
    }
    case 'file':
      ctx.warnings.add('body do tipo arquivo (binary) foi ignorado')
      return empty
    default:
      return empty
  }
}

const kvList = (list: Json): KeyValue[] =>
  (Array.isArray(list) ? list : [])
    .filter((f: Json) => f && typeof f.key === 'string')
    .map((f: Json) => kv(f.key, str(f.value), f.disabled !== true))

/** Lê um campo da auth: v2.1 usa lista [{key, value}], v2.0 usa objeto { key: value }. */
function authField(a: Json, type: string, key: string): string {
  const section = a?.[type]
  if (Array.isArray(section)) return str(section.find((x: Json) => x?.key === key)?.value)
  if (section && typeof section === 'object') return str(section[key])
  return ''
}

function convertAuth(a: Json, ctx: Ctx): Auth | null {
  switch (a?.type) {
    case 'noauth':
      return { type: 'none' }
    case 'inherit':
      return { type: 'inherit' }
    case 'bearer':
      return { type: 'bearer', token: authField(a, 'bearer', 'token') }
    case 'basic':
      return {
        type: 'basic',
        username: authField(a, 'basic', 'username'),
        password: authField(a, 'basic', 'password')
      }
    case 'apikey':
      return {
        type: 'apikey',
        key: authField(a, 'apikey', 'key') || 'x-api-key',
        value: authField(a, 'apikey', 'value'),
        addTo: authField(a, 'apikey', 'in') === 'query' ? 'query' : 'header'
      }
    default:
      ctx.warnings.add(`autenticação "${a?.type}" não é suportada (ficou sem autenticação)`)
      return { type: 'none' }
  }
}

function hasScripts(x: Json): boolean {
  return Array.isArray(x?.event) && x.event.some((e: Json) => {
    const exec = e?.script?.exec
    return Array.isArray(exec) ? exec.some((l: string) => l.trim()) : !!exec
  })
}

function countRequests(items: Item[]): number {
  return items.reduce((n, i) => n + (i.type === 'request' ? 1 : countRequests(i.items)), 0)
}

const str = (v: Json): string => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v))
