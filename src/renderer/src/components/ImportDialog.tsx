import { useEffect } from 'react'
import { useStore } from '../store'

/** Janela de importação: explica o que dá para importar e depois mostra o resumo. */
export function ImportDialog(): React.JSX.Element | null {
  const dialog = useStore((s) => s.importDialog)
  const close = useStore((s) => s.closeImport)
  const run = useStore((s) => s.runImport)
  const openEnvironments = useStore((s) => s.openEnvironments)

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
      <div className="modal" role="dialog" aria-labelledby="import-title">
        <div className="modal-head">
          <h2 id="import-title">Importar</h2>
          <button className="icon-btn" onClick={close} aria-label="Fechar">
            ✕
          </button>
        </div>

        {dialog.stage === 'intro' && (
          <>
            <p>Escolha um ou mais arquivos <code>.json</code>. Dá para importar:</p>
            <ul>
              <li>
                <b>Coleções do Postman</b> (formato v2.1 ou v2.0) — com pastas, headers, params, body e autenticação
              </li>
              <li>
                <b>Ambientes e globais do Postman</b> — viram ambientes aqui, com as mesmas variáveis
              </li>
              <li>
                <b>Arquivos exportados pelo Chamadinhas</b> — uma coleção, um ambiente ou o "Exportar tudo"
              </li>
            </ul>

            <h3>Como exportar do Postman</h3>
            <ol>
              <li>
                <b>Coleção:</b> clique nos <b>⋯</b> da coleção → <b>Export</b> → escolha <b>Collection v2.1</b> →
                Export.
              </li>
              <li>
                <b>Ambiente:</b> vá em <b>Environments</b>, clique nos <b>⋯</b> do ambiente → <b>Export</b>.
              </li>
              <li>
                <b>Tudo de uma vez:</b> Settings → <b>Data</b> → <b>Export data</b>. O Postman envia um .zip por
                e-mail; extraia e selecione todos os .json aqui.
              </li>
            </ol>

            <h3>Bom saber</h3>
            <ul className="muted-list">
              <li>As variáveis do Postman usam o mesmo formato <code>{'{{nome}}'}</code> e continuam funcionando.</li>
              <li>Variáveis da coleção do Postman viram um ambiente "… (variáveis da coleção)".</li>
              <li>Autenticação definida numa pasta é aplicada às requisições dela.</li>
              <li>Scripts (pre-request e tests), OAuth e upload de arquivos não são importados — o resumo avisa.</li>
              <li>Nada é substituído: o que vier do arquivo é adicionado ao que você já tem.</li>
            </ul>

            <div className="modal-actions">
              <button className="btn-small" onClick={close}>
                Cancelar
              </button>
              <button className="btn" onClick={run}>
                Escolher arquivos…
              </button>
            </div>
          </>
        )}

        {dialog.stage === 'busy' && <p>Importando…</p>}

        {dialog.stage === 'result' && (
          <>
            {dialog.summary.collections.length + dialog.summary.environments.length > 0 ? (
              <p className="import-ok">
                Importado: {dialog.summary.collections.length} coleção(ões) com {dialog.summary.requestCount}{' '}
                requisição(ões) e {dialog.summary.environments.length} ambiente(s).
              </p>
            ) : (
              <p className="import-fail">Nada foi importado.</p>
            )}

            <ul className="import-files">
              {dialog.summary.files.map((f, i) => (
                <li key={i} className={f.ok ? 'ok' : 'fail'}>
                  <span className="file-mark">{f.ok ? '✓' : '✕'}</span>
                  <span className="file-name">{f.name}</span>
                  <span className="file-detail">{f.detail}</span>
                </li>
              ))}
            </ul>

            {dialog.summary.environments.length > 0 && (
              <p className="hint">
                Ambientes importados: {dialog.summary.environments.join(', ')}. Ative um deles no seletor do topo
                para as <code>{'{{variáveis}}'}</code> funcionarem.
              </p>
            )}

            {dialog.summary.warnings.length > 0 && (
              <>
                <h3>Avisos</h3>
                <ul className="muted-list">
                  {dialog.summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="modal-actions">
              <button className="btn-small" onClick={run}>
                Importar mais…
              </button>
              {dialog.summary.environments.length > 0 && (
                <button
                  className="btn-small"
                  onClick={() => {
                    close()
                    openEnvironments()
                  }}
                >
                  Ver ambientes
                </button>
              )}
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
