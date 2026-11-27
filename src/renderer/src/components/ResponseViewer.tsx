import { useMemo, useState } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { terraformEditor } from '../cmTheme'
import type { HttpResponse } from '../../../shared/types'

interface Props {
  response?: HttpResponse
  sending: boolean
  onCancel(): void
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function statusClass(s: number): string {
  if (s >= 200 && s < 300) return 'ok'
  if (s >= 300 && s < 400) return 'redirect'
  return 'err'
}

export function ResponseViewer({ response, sending, onCancel }: Props): React.JSX.Element {
  const [tab, setTab] = useState<'body' | 'headers' | 'raw'>('body')
  const [copied, setCopied] = useState(false)

  const pretty = useMemo(() => {
    if (!response?.body) return { text: '', isJson: false }
    try {
      return { text: JSON.stringify(JSON.parse(response.body), null, 2), isJson: true }
    } catch {
      return { text: response.body, isJson: false }
    }
  }, [response])

  if (sending) {
    return (
      <div className="response empty">
        <div className="spinner" />
        <p>Enviando requisição...</p>
        <button className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    )
  }
  if (!response) {
    return (
      <div className="response empty">
        <p>Clique em <b>Enviar</b> (Ctrl+Enter) para ver a resposta.</p>
      </div>
    )
  }
  if (!response.ok) {
    return (
      <div className="response empty">
        <p className="error-title">Não foi possível obter resposta</p>
        <p className="error-msg">{response.error}</p>
      </div>
    )
  }

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(tab === 'raw' ? response.body : pretty.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="response">
      <div className="response-bar">
        <div className="subtabs">
          <button className={tab === 'body' ? 'active' : ''} onClick={() => setTab('body')}>
            Body
          </button>
          <button className={tab === 'headers' ? 'active' : ''} onClick={() => setTab('headers')}>
            Headers <span className="count">{response.headers.length}</span>
          </button>
          <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>
            Raw
          </button>
        </div>
        <div className="response-meta">
          <span className={'status ' + statusClass(response.status)}>
            {response.status} {response.statusText}
          </span>
          <span>{response.timeMs} ms</span>
          <span>{formatSize(response.sizeBytes)}</span>
          {tab !== 'headers' && (
            <button className="btn-small" onClick={copy}>
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          )}
        </div>
      </div>
      <div className="response-body">
        {tab === 'headers' ? (
          <table className="headers-table">
            <tbody>
              {response.headers.map(([k, v], i) => (
                <tr key={i}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <CodeMirror
            value={tab === 'raw' ? response.body : pretty.text}
            height="100%"
            theme="none"
            editable={false}
            extensions={[...terraformEditor, ...(tab === 'body' && pretty.isJson ? [json()] : []), EditorView.lineWrapping]}
            basicSetup={{ foldGutter: true, highlightActiveLine: false }}
          />
        )}
      </div>
    </div>
  )
}
