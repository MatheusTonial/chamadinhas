import { useEffect, useState } from 'react'
import { CollectionSettings } from './components/CollectionSettings'
import { RequestEditor } from './components/RequestEditor'
import { EnvSelector } from './components/EnvSelector'
import { ImportDialog } from './components/ImportDialog'
import { ExportDialog } from './components/ExportDialog'
import { EnvironmentsView } from './components/EnvironmentsView'
import { GlobeIcon, SettingsIcon } from './components/Icons'
import { Sidebar } from './components/Sidebar'
import { flushSave, useStore } from './store'

export default function App(): React.JSX.Element {
  const loaded = useStore((s) => s.loaded)
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const setActive = useStore((s) => s.setActive)
  const closeTab = useStore((s) => s.closeTab)
  const [sidebarW, setSidebarW] = useState(290)

  useEffect(() => {
    useStore.getState().init()

    window.api.onCloseRequest(async () => {
      const dirty = useStore.getState().tabs.filter((t) => t.dirty)
      if (
        dirty.length &&
        !confirm(`${dirty.length} aba(s) com alterações não salvas:\n${dirty.map((t) => '• ' + t.draft.name).join('\n')}\n\nSair mesmo assim?`)
      )
        return
      await flushSave()
      window.api.confirmClose()
    })

    const onKey = (e: KeyboardEvent): void => {
      const s = useStore.getState()
      const id = s.activeTabId
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        s.addLooseRequest()
      } else if (k === 's' && id) {
        e.preventDefault()
        s.saveTab(id)
      } else if (k === 'enter' && id) {
        e.preventDefault()
        s.send(id)
      } else if (k === 'w' && id) {
        e.preventDefault()
        s.closeTab(id)
      } else if (k === 'tab' && s.tabs.length > 1) {
        e.preventDefault()
        const i = s.tabs.findIndex((t) => t.id === id)
        const n = (i + (e.shiftKey ? -1 : 1) + s.tabs.length) % s.tabs.length
        s.setActive(s.tabs[n].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const onMove = (ev: MouseEvent): void => setSidebarW(Math.min(560, Math.max(200, ev.clientX)))
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!loaded) return <div className="loading">Carregando...</div>

  const active = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="app" style={{ gridTemplateColumns: `${sidebarW}px 4px 1fr` }}>
      <Sidebar />
      <div className="sidebar-resize" onMouseDown={startResize} />
      <main className="main">
        <div className="top-bar">
        <div className="tabs-bar">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={'tab' + (t.id === activeTabId ? ' active' : '')}
              onClick={() => setActive(t.id)}
              onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
              title={t.draft.name}
            >
              {t.kind === 'request' ? (
                <span className={'method-badge m-' + t.draft.method}>
                  {t.draft.method === 'DELETE' ? 'DEL' : t.draft.method}
                </span>
              ) : t.kind === 'environments' ? (
                <GlobeIcon />
              ) : (
                <SettingsIcon />
              )}
              <span className="tab-name">{t.draft.name}</span>
              <button
                className={'tab-close' + (t.dirty ? ' dirty' : '')}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.id)
                }}
                title={t.dirty ? 'Não salvo — fechar' : 'Fechar (Ctrl+W)'}
              >
                <span className="dirty-dot">●</span>
                <span className="x">✕</span>
              </button>
            </div>
          ))}
        </div>
        <EnvSelector />
        </div>
        <div className="tab-content">
          {!active && (
            <div className="welcome">
              <h1>Chamadinhas</h1>
              <p>Comece uma requisição agora ou organize tudo em coleções pela barra lateral.</p>
              <button className="btn" onClick={() => useStore.getState().addLooseRequest()}>
                + Nova requisição
              </button>
              <ul>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>N</kbd> nova requisição
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> enviar
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>S</kbd> salvar
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>W</kbd> fechar aba
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Tab</kbd> próxima aba
                </li>
              </ul>
              <p className="hint">
                Valores que mudam entre dev e produção?{' '}
                <button className="link-btn" onClick={() => useStore.getState().openEnvironments()}>
                  Veja como usar ambientes e variáveis
                </button>
              </p>
              <p className="hint">
                Vindo do Postman?{' '}
                <button className="link-btn" onClick={() => useStore.getState().openImport()}>
                  Importe suas coleções e ambientes
                </button>
              </p>
              <p className="hint">Dados salvos automaticamente em %APPDATA%\Chamadinhas\data.json</p>
            </div>
          )}
          {active?.kind === 'request' && <RequestEditor key={active.id} tab={active} />}
          {active?.kind === 'collection' && <CollectionSettings key={active.id} tab={active} />}
          {active?.kind === 'environments' && <EnvironmentsView />}
        </div>
      </main>
      <ImportDialog />
      <ExportDialog />
    </div>
  )
}
