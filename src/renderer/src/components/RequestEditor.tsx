import { useRef, useState } from 'react'
import type { HttpMethod, KeyValue } from '../../../shared/types'
import { useStore, type RequestTab } from '../store'
import { locate, pathNames, syncParamsFromUrl, urlWithParams } from '../tree'
import { AuthEditor, authSummary } from './AuthEditor'
import { BodyEditor } from './BodyEditor'
import { KeyValueTable } from './KeyValueTable'
import { ResponseViewer } from './ResponseViewer'
import { VarPreview } from './VarPreview'

export const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Api-Key',
  'X-Request-Id',
  'X-Correlation-Id'
]

type SubTab = 'params' | 'headers' | 'auth' | 'body'

export function RequestEditor({ tab }: { tab: RequestTab }): React.JSX.Element {
  const update = useStore((s) => s.updateRequestDraft)
  const send = useStore((s) => s.send)
  const cancel = useStore((s) => s.cancel)
  const save = useStore((s) => s.saveTab)
  const collections = useStore((s) => s.data.collections)
  const [sub, setSub] = useState<SubTab>('params')
  const [split, setSplit] = useState(45) // % de altura do editor
  const containerRef = useRef<HTMLDivElement>(null)

  const r = tab.draft
  const located = locate(collections, tab.id)
  const collection = located?.collection

  const setParams = (params: KeyValue[]): void => update(tab.id, { params, url: urlWithParams(r.url, params) })
  const setUrl = (url: string): void => update(tab.id, { url, params: syncParamsFromUrl(url, r.params) })

  const count = (rows: KeyValue[]): number => rows.filter((x) => x.enabled && x.key).length
  const inheritedHeaders = collection ? count(collection.headers) : 0
  const bodyActive = r.body.mode !== 'none'

  const startDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const onMove = (ev: MouseEvent): void => {
      const pct = ((ev.clientY - rect.top) / rect.height) * 100
      setSplit(Math.min(80, Math.max(20, pct)))
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="request-editor" ref={containerRef}>
      <div className="editor-top" style={{ height: `${split}%` }}>
        <div className="breadcrumb">
          {pathNames(collections, tab.id)
            .slice(0, -1)
            .map((n, i) => (
              <span key={i}>
                {n} <span className="sep">/</span>
              </span>
            ))}
          <b>{r.name}</b>
          {tab.dirty && (
            <button className="btn-small push-right" onClick={() => save(tab.id)} title="Ctrl+S">
              Salvar
            </button>
          )}
        </div>
        <div className="url-bar">
          <select
            className={'method-select m-' + r.method}
            value={r.method}
            onChange={(e) => update(tab.id, { method: e.target.value as HttpMethod })}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="url-input mono"
            value={r.url}
            placeholder="https://api.exemplo.com/recurso  ou  {{baseUrl}}/recurso"
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(tab.id)
            }}
          />
          {tab.sending ? (
            <button className="btn send-btn cancel" onClick={() => cancel(tab.id)}>
              Cancelar
            </button>
          ) : (
            <button className="btn send-btn" onClick={() => send(tab.id)} disabled={!r.url.trim()}>
              Enviar
            </button>
          )}
        </div>
        <VarPreview request={r} collection={collection} />
        <div className="subtabs">
          <button className={sub === 'params' ? 'active' : ''} onClick={() => setSub('params')}>
            Params {count(r.params) > 0 && <span className="count">{count(r.params)}</span>}
          </button>
          <button className={sub === 'headers' ? 'active' : ''} onClick={() => setSub('headers')}>
            Headers {count(r.headers) > 0 && <span className="count">{count(r.headers)}</span>}
          </button>
          <button className={sub === 'auth' ? 'active' : ''} onClick={() => setSub('auth')}>
            Auth {r.auth.type !== 'none' && r.auth.type !== 'inherit' && <span className="dot" />}
          </button>
          <button className={sub === 'body' ? 'active' : ''} onClick={() => setSub('body')}>
            Body {bodyActive && <span className="dot" />}
          </button>
        </div>
        <div className="subtab-content">
          {sub === 'params' && <KeyValueTable rows={r.params} onChange={setParams} />}
          {sub === 'headers' && (
            <>
              {inheritedHeaders > 0 && (
                <p className="hint">
                  + {inheritedHeaders} header(s) herdado(s) da coleção "{collection!.name}". Headers definidos aqui têm
                  prioridade.
                </p>
              )}
              <KeyValueTable
                rows={r.headers}
                onChange={(headers) => update(tab.id, { headers })}
                keyPlaceholder="Header"
                keySuggestions={COMMON_HEADERS}
                listId="common-headers"
              />
            </>
          )}
          {sub === 'auth' && (
            <AuthEditor
              auth={r.auth}
              allowInherit
              inheritedLabel={collection ? authSummary(collection.auth) : undefined}
              onChange={(auth) => update(tab.id, { auth })}
            />
          )}
          {sub === 'body' && <BodyEditor body={r.body} onChange={(body) => update(tab.id, { body })} />}
        </div>
      </div>
      <div className="split-handle" onMouseDown={startDrag} />
      <div className="editor-bottom">
        <ResponseViewer response={tab.response} sending={tab.sending} onCancel={() => cancel(tab.id)} />
      </div>
    </div>
  )
}
