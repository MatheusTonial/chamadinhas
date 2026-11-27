import { useState } from 'react'
import type { KeyValue } from '../../../shared/types'
import { kv } from '../tree'

interface Props {
  rows: KeyValue[]
  onChange(rows: KeyValue[]): void
  keyPlaceholder?: string
  valuePlaceholder?: string
  keySuggestions?: string[]
  listId?: string
}

/** Tabela chave/valor com uma linha vazia no final para adicionar (estilo Postman). */
export function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Chave',
  valuePlaceholder = 'Valor',
  keySuggestions,
  listId
}: Props): React.JSX.Element {
  const [focus, setFocus] = useState<{ id: string; field: 'key' | 'value' } | null>(null)
  const update = (id: string, patch: Partial<KeyValue>): void =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const addFromBlank = (field: 'key' | 'value', value: string): void => {
    const row = kv()
    row[field] = value
    setFocus({ id: row.id, field })
    onChange([...rows, row])
  }

  return (
    <div className="kv-table">
      {keySuggestions && listId && (
        <datalist id={listId}>
          {keySuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <div className="kv-row kv-head">
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((r) => (
        <div key={r.id} className={'kv-row' + (r.enabled ? '' : ' disabled')}>
          <input
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => update(r.id, { enabled: e.target.checked })}
            title="Ativar/desativar"
          />
          <input
            value={r.key}
            placeholder={keyPlaceholder}
            list={listId}
            autoFocus={focus?.id === r.id && focus.field === 'key'}
            onChange={(e) => update(r.id, { key: e.target.value })}
          />
          <input
            value={r.value}
            placeholder={valuePlaceholder}
            autoFocus={focus?.id === r.id && focus.field === 'value'}
            onChange={(e) => update(r.id, { value: e.target.value })}
          />
          <button className="icon-btn" title="Remover" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>
            ✕
          </button>
        </div>
      ))}
      <div className="kv-row kv-blank">
        <span />
        <input
          value=""
          placeholder={keyPlaceholder}
          list={listId}
          onChange={(e) => addFromBlank('key', e.target.value)}
        />
        <input value="" placeholder={valuePlaceholder} onChange={(e) => addFromBlank('value', e.target.value)} />
        <span />
      </div>
    </div>
  )
}
