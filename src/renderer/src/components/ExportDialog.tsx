import { useEffect, useState } from 'react'
import { useStore } from '../store'

/** Janela "Exportar tudo": todas as coleções e ambientes num único .json. */
export function ExportDialog(): React.JSX.Element | null {
  const dialog = useStore((s) => s.exportDialog)
  const close = useStore((s) => s.closeExport)
  const run = useStore((s) => s.runExport)
  const collections = useStore((s) => s.data.collections)
  const environments = useStore((s) => s.data.environments ?? [])
  const [removeSecrets, setRemoveSecrets] = useState(false)

  useEffect(() => {
    if (!dialog) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, close])

  if (!dialog) return null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">Exportar tudo</h2>
          <button className="icon-btn" onClick={close} aria-label="Fechar">
            ✕
          </button>
        </div>

        {dialog.stage === 'options' && (
          <>
            <p>
              Gera um único arquivo <code>.json</code> com <b>{collections.length} coleção(ões)</b> e{' '}
              <b>{environments.length} ambiente(s)</b>. Serve de backup ou para levar tudo para outro computador —
              é só usar <b>Importar</b> lá.
            </p>

            <label className="check-option">
              <input type="checkbox" checked={removeSecrets} onChange={(e) => setRemoveSecrets(e.target.checked)} />
              <span>
                <b>Remover segredos</b> (para compartilhar com outra pessoa)
                <span className="check-hint">
                  Apaga os valores das variáveis dos ambientes, os tokens Bearer, as senhas do Basic Auth e os valores
                  de API Key. Nomes, URLs, headers e bodies continuam no arquivo.
                </span>
              </span>
            </label>

            {!removeSecrets && (
              <p className="hint">
                Sem essa opção o arquivo leva tokens e senhas em texto puro — guarde-o com cuidado.
              </p>
            )}

            <div className="modal-actions">
              <button className="btn-small" onClick={close}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={() => run(removeSecrets)}
                disabled={collections.length + environments.length === 0}
              >
                Salvar arquivo…
              </button>
            </div>
          </>
        )}

        {dialog.stage === 'done' && (
          <>
            <p className="import-ok">Exportado.</p>
            <p>
              Arquivo salvo em <code className="path">{dialog.path}</code>
            </p>
            {dialog.removeSecrets && (
              <p className="hint">Os segredos foram removidos; quem importar precisa preencher os valores.</p>
            )}
            <div className="modal-actions">
              <button className="btn" onClick={close}>
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
