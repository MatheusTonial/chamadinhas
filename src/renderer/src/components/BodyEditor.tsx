import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { terraformEditor } from '../cmTheme'
import type { Body, BodyMode } from '../../../shared/types'
import { KeyValueTable } from './KeyValueTable'

const MODES: [BodyMode, string][] = [
  ['none', 'nenhum'],
  ['json', 'JSON'],
  ['text', 'Texto'],
  ['urlencoded', 'x-www-form-urlencoded'],
  ['formdata', 'form-data']
]

interface Props {
  body: Body
  onChange(body: Body): void
}

export function BodyEditor({ body, onChange }: Props): React.JSX.Element {
  let jsonError = ''
  if (body.mode === 'json' && body.raw.trim()) {
    try {
      JSON.parse(body.raw)
    } catch (e) {
      jsonError = (e as Error).message
    }
  }

  const format = (): void => {
    try {
      onChange({ ...body, raw: JSON.stringify(JSON.parse(body.raw), null, 2) })
    } catch {
      /* JSON inválido: mantém */
    }
  }

  return (
    <div className="body-editor">
      <div className="body-modes">
        {MODES.map(([m, label]) => (
          <label key={m} className="radio">
            <input type="radio" checked={body.mode === m} onChange={() => onChange({ ...body, mode: m })} />
            {label}
          </label>
        ))}
        {body.mode === 'json' && (
          <button className="btn-small push-right" onClick={format} disabled={!!jsonError}>
            Formatar
          </button>
        )}
      </div>
      {body.mode === 'none' && <p className="empty-hint">Esta requisição não tem corpo.</p>}
      {(body.mode === 'json' || body.mode === 'text') && (
        <>
          <div className="code-wrap">
            <CodeMirror
              value={body.raw}
              height="100%"
              theme="none"
              extensions={[...terraformEditor, ...(body.mode === 'json' ? [json()] : [])]}
              basicSetup={{ foldGutter: true, highlightActiveLine: false }}
              onChange={(raw) => onChange({ ...body, raw })}
            />
          </div>
          {jsonError && <div className="json-error">JSON inválido: {jsonError}</div>}
        </>
      )}
      {(body.mode === 'urlencoded' || body.mode === 'formdata') && (
        <KeyValueTable rows={body.fields} onChange={(fields) => onChange({ ...body, fields })} />
      )}
    </div>
  )
}
