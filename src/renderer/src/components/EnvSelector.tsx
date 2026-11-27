import { useStore } from '../store'
import { GlobeIcon } from './Icons'

/** Seletor do ambiente ativo, no canto direito da barra de abas. */
export function EnvSelector(): React.JSX.Element {
  const environments = useStore((s) => s.data.environments ?? [])
  const activeId = useStore((s) => s.data.activeEnvironmentId ?? null)
  const setActive = useStore((s) => s.setActiveEnvironment)
  const open = useStore((s) => s.openEnvironments)

  return (
    <div className="env-selector">
      <GlobeIcon />
      <select
        value={activeId ?? ''}
        onChange={(e) => setActive(e.target.value || null)}
        title="Ambiente ativo: define o valor das {{variáveis}}"
      >
        <option value="">Sem ambiente</option>
        {environments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <button className="btn-small" onClick={open} title="Gerenciar ambientes e ver como usar variáveis">
        Ambientes
      </button>
      <button className="help-btn" onClick={open} title="Como usar variáveis" aria-label="Como usar variáveis">
        ?
      </button>
    </div>
  )
}
