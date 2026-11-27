import { useState } from 'react'
import { useStore } from '../store'
import { KeyValueTable } from './KeyValueTable'

/** Tela "Ambientes": lista à esquerda, variáveis do ambiente selecionado e o guia de uso. */
export function EnvironmentsView(): React.JSX.Element {
  const environments = useStore((s) => s.data.environments ?? [])
  const activeId = useStore((s) => s.data.activeEnvironmentId ?? null)
  const exportEnvironment = useStore((s) => s.exportEnvironment)
  const { addEnvironment, updateEnvironment, duplicateEnvironment, removeEnvironment, setActiveEnvironment } =
    useStore.getState()
  const [selectedId, setSelectedId] = useState<string | null>(activeId ?? environments[0]?.id ?? null)
  const selected = environments.find((e) => e.id === selectedId) ?? environments[0]

  return (
    <div className="env-view">
      <div className="env-main">
        <aside className="env-list">
          <div className="env-list-head">
            <span>Ambientes</span>
            <button className="btn btn-compact" onClick={() => setSelectedId(addEnvironment())}>
              + Novo
            </button>
          </div>
          {environments.length === 0 && <p className="hint">Nenhum ambiente ainda.</p>}
          {environments.map((e) => (
            <button
              key={e.id}
              className={'env-item' + (e.id === selected?.id ? ' selected' : '')}
              onClick={() => setSelectedId(e.id)}
            >
              <span className="env-name">{e.name}</span>
              {e.id === activeId && <span className="env-badge">ativo</span>}
            </button>
          ))}
        </aside>

        <section className="env-editor">
          {!selected ? (
            <div className="env-empty">
              <p>Crie um ambiente para guardar valores como a URL base e tokens.</p>
              <button className="btn" onClick={() => setSelectedId(addEnvironment())}>
                + Criar primeiro ambiente
              </button>
            </div>
          ) : (
            <>
              <div className="env-editor-head">
                <div className="field env-name-field">
                  <label>Nome do ambiente</label>
                  <input
                    value={selected.name}
                    onChange={(e) => updateEnvironment(selected.id, { name: e.target.value })}
                  />
                </div>
                <div className="env-actions">
                  {selected.id === activeId ? (
                    <button className="btn-small" onClick={() => setActiveEnvironment(null)}>
                      Desativar
                    </button>
                  ) : (
                    <button className="btn btn-compact" onClick={() => setActiveEnvironment(selected.id)}>
                      Usar este ambiente
                    </button>
                  )}
                  <button className="btn-small" onClick={() => setSelectedId(duplicateEnvironment(selected.id))}>
                    Duplicar
                  </button>
                  <button
                    className="btn-small"
                    title="Salva este ambiente num .json (com os valores) para importar em outro lugar"
                    onClick={() => exportEnvironment(selected.id)}
                  >
                    Exportar
                  </button>
                  <button
                    className="btn-small danger"
                    onClick={() => {
                      if (removeEnvironment(selected.id)) setSelectedId(null)
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <KeyValueTable
                rows={selected.variables}
                onChange={(variables) => updateEnvironment(selected.id, { variables })}
                keyPlaceholder="Variável"
                valuePlaceholder="Valor"
              />
              <p className="hint">As alterações nos ambientes são salvas automaticamente.</p>
            </>
          )}
        </section>
      </div>

      <EnvironmentsHelp />
    </div>
  )
}

function EnvironmentsHelp(): React.JSX.Element {
  return (
    <aside className="env-help">
      <h3>Como usar variáveis</h3>
      <p>
        Variáveis guardam valores que você repete em várias requisições, como a URL do servidor ou um token. Cada{' '}
        <b>ambiente</b> (ex.: Dev, Homologação, Produção) tem seus próprios valores para os mesmos nomes.
      </p>

      <h4>1. Crie um ambiente e as variáveis</h4>
      <p>
        Clique em <b>+ Novo</b>, dê um nome e preencha a tabela com o nome da variável e o valor. Exemplo:
      </p>
      <table className="help-table">
        <thead>
          <tr>
            <th>Variável</th>
            <th>Dev</th>
            <th>Produção</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>baseUrl</td>
            <td>http://localhost:3000</td>
            <td>https://api.empresa.com</td>
          </tr>
          <tr>
            <td>token</td>
            <td>token-de-teste</td>
            <td>token-real</td>
          </tr>
        </tbody>
      </table>

      <h4>2. Use com chaves duplas</h4>
      <p>
        Escreva <code>{'{{nome}}'}</code> em qualquer lugar da requisição: URL, params, headers, autenticação e body.
      </p>
      <ul>
        <li>
          URL: <code>{'{{baseUrl}}/usuarios'}</code>
        </li>
        <li>
          Auth → Bearer Token: <code>{'{{token}}'}</code>
        </li>
        <li>
          Header: <code>X-Api-Key</code> = <code>{'{{apiKey}}'}</code>
        </li>
        <li>
          Body JSON: <code>{'{ "email": "{{email}}" }'}</code>
        </li>
      </ul>
      <p>Também funciona nos headers e na autenticação da coleção.</p>

      <h4>3. Escolha o ambiente ativo</h4>
      <p>
        Use o seletor no canto superior direito (ou <b>Usar este ambiente</b> aqui). Ao enviar, cada{' '}
        <code>{'{{nome}}'}</code> é trocado pelo valor do ambiente ativo. Trocar o ambiente troca todos os valores de
        uma vez.
      </p>

      <h4>Dicas</h4>
      <ul>
        <li>Abaixo da URL aparece quais variáveis a requisição usa e o valor de cada uma.</li>
        <li>
          Variável não encontrada fica <span className="help-missing">em vermelho</span> e é enviada como texto
          literal <code>{'{{nome}}'}</code>.
        </li>
        <li>Desmarque a caixinha de uma variável para ignorá-la sem apagar.</li>
        <li>
          Nomes aceitam letras, números, <code>_</code>, <code>-</code> e <code>.</code> — e diferenciam maiúsculas
          (<code>Token</code> ≠ <code>token</code>).
        </li>
        <li>Use Duplicar para criar Produção a partir de Dev e só trocar os valores.</li>
      </ul>
    </aside>
  )
}
