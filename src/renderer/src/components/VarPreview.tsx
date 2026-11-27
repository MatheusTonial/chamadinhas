import type { Collection, RequestItem } from '../../../shared/types'
import { useStore } from '../store'
import { activeVars, usedVars } from '../vars'

/** Mostra, abaixo da URL, as {{variáveis}} que a requisição usa e o valor de cada uma no ambiente ativo. */
export function VarPreview({ request, collection }: { request: RequestItem; collection?: Collection }): React.JSX.Element | null {
  const data = useStore((s) => s.data)
  const openEnvironments = useStore((s) => s.openEnvironments)
  const names = usedVars(request, collection)
  if (names.length === 0) return null

  const env = data.environments?.find((e) => e.id === data.activeEnvironmentId)
  const vars = activeVars(data)
  const missing = names.filter((n) => !vars.has(n)).length

  return (
    <div className="var-preview">
      <span className="var-env">
        {env ? (
          <>
            Ambiente: <b>{env.name}</b>
          </>
        ) : (
          <span className="var-missing">Nenhum ambiente ativo</span>
        )}
      </span>
      {names.map((n) => {
        const ok = vars.has(n)
        const value = vars.get(n) ?? ''
        return (
          <span
            key={n}
            className={'var-chip' + (ok ? '' : ' missing')}
            title={ok ? `${n} = ${value}` : `"${n}" não está definida no ambiente ativo`}
          >
            <span className="var-name">{n}</span>
            <span className="var-value">{ok ? value || '(vazio)' : 'não definida'}</span>
          </span>
        )
      })}
      {missing > 0 && (
        <button className="link-btn" onClick={openEnvironments}>
          {env ? 'Definir variáveis' : 'Escolher ambiente'}
        </button>
      )}
    </div>
  )
}
