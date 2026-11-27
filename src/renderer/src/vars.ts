import type { AppData, Auth, Body, Collection, KeyValue, RequestItem } from '../../shared/types'

/** {{nome}} — letras, números, _ - . (espaços nas bordas são tolerados: {{ nome }}) */
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g

export type Vars = Map<string, string>

/** Variáveis habilitadas do ambiente ativo. */
export function activeVars(data: AppData): Vars {
  const env = data.environments?.find((e) => e.id === data.activeEnvironmentId)
  const vars: Vars = new Map()
  for (const v of env?.variables ?? []) {
    if (v.enabled && v.key.trim()) vars.set(v.key.trim(), v.value)
  }
  return vars
}

/** Troca {{nome}} pelo valor; variáveis não definidas ficam como estão. */
export function resolve(text: string, vars: Vars): string {
  return text.replace(VAR_RE, (whole, name: string) => (vars.has(name) ? vars.get(name)! : whole))
}

const resolveKv = (rows: KeyValue[], vars: Vars): KeyValue[] =>
  rows.map((r) => ({ ...r, key: resolve(r.key, vars), value: resolve(r.value, vars) }))

export function resolveAuth(a: Auth, vars: Vars): Auth {
  switch (a.type) {
    case 'bearer':
      return { ...a, token: resolve(a.token, vars) }
    case 'basic':
      return { ...a, username: resolve(a.username, vars), password: resolve(a.password, vars) }
    case 'apikey':
      return { ...a, key: resolve(a.key, vars), value: resolve(a.value, vars) }
    default:
      return a
  }
}

export function resolveBody(b: Body, vars: Vars): Body {
  return { ...b, raw: resolve(b.raw, vars), fields: resolveKv(b.fields, vars) }
}

export function resolveRequest(r: RequestItem, vars: Vars): RequestItem {
  return {
    ...r,
    url: resolve(r.url, vars),
    headers: resolveKv(r.headers, vars),
    auth: resolveAuth(r.auth, vars),
    body: resolveBody(r.body, vars)
  }
}

export function resolveCollectionVars(c: Collection, vars: Vars): Collection {
  return { ...c, headers: resolveKv(c.headers, vars), auth: resolveAuth(c.auth, vars) }
}

function namesIn(text: string, out: Set<string>): void {
  for (const m of text.matchAll(VAR_RE)) out.add(m[1])
}

function authTexts(a: Auth): string[] {
  switch (a.type) {
    case 'bearer':
      return [a.token]
    case 'basic':
      return [a.username, a.password]
    case 'apikey':
      return [a.key, a.value]
    default:
      return []
  }
}

/** Nomes de variáveis usados por uma requisição (incluindo o que ela herda da coleção). */
export function usedVars(r: RequestItem, collection?: Collection): string[] {
  const out = new Set<string>()
  const enabled = (rows: KeyValue[]): string[] => rows.filter((x) => x.enabled).flatMap((x) => [x.key, x.value])
  const texts = [
    r.url,
    ...enabled(r.headers),
    ...authTexts(r.auth.type === 'inherit' && collection ? collection.auth : r.auth),
    ...(r.body.mode === 'json' || r.body.mode === 'text' ? [r.body.raw] : []),
    ...(r.body.mode === 'urlencoded' || r.body.mode === 'formdata' ? enabled(r.body.fields) : []),
    ...(collection ? enabled(collection.headers) : [])
  ]
  texts.forEach((t) => namesIn(t, out))
  return [...out]
}
