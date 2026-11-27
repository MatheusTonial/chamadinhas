export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValue {
  id: string
  enabled: boolean
  key: string
  value: string
}

export type Auth =
  | { type: 'inherit' }
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apikey'; key: string; value: string; addTo: 'header' | 'query' }

export type BodyMode = 'none' | 'json' | 'text' | 'urlencoded' | 'formdata'

export interface Body {
  mode: BodyMode
  raw: string
  fields: KeyValue[]
}

export interface RequestItem {
  type: 'request'
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  auth: Auth
  body: Body
}

export interface FolderItem {
  type: 'folder'
  id: string
  name: string
  items: Item[]
}

export type Item = RequestItem | FolderItem

export interface Collection {
  id: string
  name: string
  /** Coleção genérica criada automaticamente para requisições avulsas */
  isDefault?: boolean
  auth: Auth
  headers: KeyValue[]
  items: Item[]
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
}

export interface AppData {
  version: 1
  collections: Collection[]
  /** Opcional: arquivos antigos (antes dos ambientes) não têm este campo */
  environments?: Environment[]
  activeEnvironmentId?: string | null
}

/** Requisição já resolvida (auth/headers herdados aplicados), enviada ao processo main. */
export interface SendPayload {
  requestId: string
  method: HttpMethod
  url: string
  headers: [string, string][]
  body: Body
  timeoutMs: number
}

export interface HttpResponse {
  ok: boolean
  status: number
  statusText: string
  timeMs: number
  sizeBytes: number
  headers: [string, string][]
  body: string
  error?: string
}

export interface Api {
  send(payload: SendPayload): Promise<HttpResponse>
  cancel(requestId: string): Promise<void>
  loadData(): Promise<AppData>
  saveData(data: AppData): Promise<void>
  /** Abre "Salvar como" e grava o JSON; devolve o caminho salvo ou null se cancelado */
  saveJsonFile(title: string, defaultName: string, data: unknown): Promise<string | null>
  /** Abre o seletor de arquivos e devolve nome e conteúdo de cada .json escolhido */
  pickImportFiles(): Promise<{ name: string; text: string }[]>
  onCloseRequest(cb: () => void): void
  confirmClose(): Promise<void>
  setTheme(theme: 'light' | 'dark'): void
}
