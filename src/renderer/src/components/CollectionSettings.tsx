import { useState } from 'react'
import { useStore, type CollectionTab } from '../store'
import { AuthEditor } from './AuthEditor'
import { KeyValueTable } from './KeyValueTable'
import { COMMON_HEADERS } from './RequestEditor'

export function CollectionSettings({ tab }: { tab: CollectionTab }): React.JSX.Element {
  const update = useStore((s) => s.updateCollectionDraft)
  const save = useStore((s) => s.saveTab)
  const [sub, setSub] = useState<'auth' | 'headers'>('auth')
  const d = tab.draft

  return (
    <div className="collection-settings">
      <div className="breadcrumb">
        Configurações da coleção
        {tab.dirty && (
          <button className="btn-small push-right" onClick={() => save(tab.id)} title="Ctrl+S">
            Salvar
          </button>
        )}
      </div>
      <div className="field">
        <label>Nome</label>
        <input value={d.name} onChange={(e) => update(tab.id, { name: e.target.value })} />
      </div>
      <p className="hint">
        Autenticação e headers definidos aqui são aplicados a todas as requisições da coleção (requisições com
        Auth = "Herdar da coleção").
      </p>
      <div className="subtabs">
        <button className={sub === 'auth' ? 'active' : ''} onClick={() => setSub('auth')}>
          Auth
        </button>
        <button className={sub === 'headers' ? 'active' : ''} onClick={() => setSub('headers')}>
          Headers
        </button>
      </div>
      <div className="subtab-content">
        {sub === 'auth' && (
          <AuthEditor auth={d.auth} allowInherit={false} onChange={(auth) => update(tab.id, { auth })} />
        )}
        {sub === 'headers' && (
          <KeyValueTable
            rows={d.headers}
            onChange={(headers) => update(tab.id, { headers })}
            keyPlaceholder="Header"
            keySuggestions={COMMON_HEADERS}
            listId="common-headers-col"
          />
        )}
      </div>
    </div>
  )
}
