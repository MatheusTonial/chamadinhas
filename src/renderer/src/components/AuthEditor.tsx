import { useState } from 'react'
import type { Auth } from '../../../shared/types'

interface Props {
  auth: Auth
  onChange(auth: Auth): void
  allowInherit: boolean
  inheritedLabel?: string
}

const LABELS: Record<Auth['type'], string> = {
  inherit: 'Herdar da coleção',
  none: 'Sem autenticação',
  bearer: 'Bearer Token',
  basic: 'Basic Auth',
  apikey: 'API Key'
}

function defaults(type: Auth['type']): Auth {
  switch (type) {
    case 'bearer':
      return { type, token: '' }
    case 'basic':
      return { type, username: '', password: '' }
    case 'apikey':
      return { type, key: '', value: '', addTo: 'header' }
    default:
      return { type }
  }
}

export function AuthEditor({ auth, onChange, allowInherit, inheritedLabel }: Props): React.JSX.Element {
  const [showSecret, setShowSecret] = useState(false)
  const types = (Object.keys(LABELS) as Auth['type'][]).filter((t) => allowInherit || t !== 'inherit')
  const secretType = showSecret ? 'text' : 'password'

  return (
    <div className="auth-editor">
      <div className="auth-side">
        <label>Tipo</label>
        <select value={auth.type} onChange={(e) => onChange(defaults(e.target.value as Auth['type']))}>
          {types.map((t) => (
            <option key={t} value={t}>
              {LABELS[t]}
            </option>
          ))}
        </select>
        <p className="hint">
          {auth.type === 'inherit' && `Usa a autenticação da coleção${inheritedLabel ? ` (${inheritedLabel})` : ''}.`}
          {auth.type === 'bearer' && 'Envia o header Authorization: Bearer <token>.'}
          {auth.type === 'basic' && 'Envia Authorization: Basic com usuário:senha em base64.'}
          {auth.type === 'apikey' && 'Envia a chave como header ou parâmetro de query.'}
          {auth.type === 'none' && 'Nenhum header de autenticação será adicionado.'}
        </p>
        <p className="hint">Um header Authorization definido manualmente tem prioridade.</p>
      </div>
      <div className="auth-fields">
        {auth.type === 'bearer' && (
          <div className="field">
            <label>Token</label>
            <textarea
              className="mono"
              rows={4}
              value={auth.token}
              placeholder="eyJhbGciOi..."
              onChange={(e) => onChange({ ...auth, token: e.target.value })}
            />
          </div>
        )}
        {auth.type === 'basic' && (
          <>
            <div className="field">
              <label>Usuário</label>
              <input value={auth.username} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
            </div>
            <div className="field">
              <label>Senha</label>
              <div className="with-toggle">
                <input
                  type={secretType}
                  value={auth.password}
                  onChange={(e) => onChange({ ...auth, password: e.target.value })}
                />
                <button className="btn-small" onClick={() => setShowSecret((v) => !v)}>
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </>
        )}
        {auth.type === 'apikey' && (
          <>
            <div className="field">
              <label>Nome</label>
              <input
                value={auth.key}
                placeholder="x-api-key"
                onChange={(e) => onChange({ ...auth, key: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valor</label>
              <div className="with-toggle">
                <input
                  type={secretType}
                  value={auth.value}
                  onChange={(e) => onChange({ ...auth, value: e.target.value })}
                />
                <button className="btn-small" onClick={() => setShowSecret((v) => !v)}>
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Adicionar em</label>
              <select
                value={auth.addTo}
                onChange={(e) => onChange({ ...auth, addTo: e.target.value as 'header' | 'query' })}
              >
                <option value="header">Header</option>
                <option value="query">Query params</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function authSummary(auth: Auth): string {
  return LABELS[auth.type]
}
