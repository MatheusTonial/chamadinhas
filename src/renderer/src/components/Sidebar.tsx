import { useEffect, useState } from 'react'
import type { Collection, Item } from '../../../shared/types'
import { useStore } from '../store'
import logoUrl from '../assets/logo.svg'
import { CollectionIcon, FolderIcon, InboxIcon, MoonIcon, SunIcon } from './Icons'

interface MenuState {
  x: number
  y: number
  id: string
  kind: 'collection' | 'folder' | 'request'
}

type DropPos = 'inside' | 'before' | 'after'
/** tipo do arrasto de coleção (reordenar), separado do arrasto de requisições/pastas */
const COLLECTION_DND = 'application/x-chamadinhas-collection'

function matches(item: Item, q: string): boolean {
  if (item.name.toLowerCase().includes(q)) return true
  if (item.type === 'request') return item.url.toLowerCase().includes(q)
  return item.items.some((c) => matches(c, q))
}

export function Sidebar(): React.JSX.Element {
  const collections = useStore((s) => s.data.collections)
  const addCollection = useStore((s) => s.addCollection)
  const openImport = useStore((s) => s.openImport)
  const openExport = useStore((s) => s.openExport)
  const addLooseRequest = useStore((s) => s.addLooseRequest)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  const openMenu = (e: React.MouseEvent, id: string, kind: MenuState['kind']): void => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, id, kind })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img className="logo-img" src={logoUrl} alt="" />
        <span className="logo">Chamadinhas</span>
        <button
          className="icon-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>
      <div className="sidebar-actions">
        <button className="btn btn-compact" onClick={addLooseRequest} title="Nova requisição (Ctrl+N)">
          + Requisição
        </button>
        <button className="btn-small" onClick={addCollection} title="Nova coleção">
          + Coleção
        </button>
        <button className="btn-small" onClick={openImport} title="Importar do Postman ou de arquivo .json">
          Importar
        </button>
        <button className="btn-small" onClick={openExport} title="Exportar todas as coleções e ambientes num arquivo">
          Exportar
        </button>
      </div>
      <input
        className="sidebar-filter"
        placeholder="Filtrar..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="tree">
        {collections.length === 0 && (
          <div className="empty-hint">
            Nada salvo ainda.
            <br />
            <button className="btn" onClick={addLooseRequest}>
              Nova requisição
            </button>
            <br />
            <button className="btn-small" onClick={addCollection}>
              ou criar uma coleção
            </button>
          </div>
        )}
        {collections.map((c) => (
          <CollectionNode key={c.id} c={c} q={q} openMenu={openMenu} />
        ))}
      </div>
      {menu && <ContextMenu menu={menu} />}
    </aside>
  )
}

type OpenMenu = (e: React.MouseEvent, id: string, kind: MenuState['kind']) => void

type DropMode = 'inside-only' | 'both' | 'before-only'

function useDnd(id: string, mode: DropMode): {
  rowProps: React.HTMLAttributes<HTMLDivElement>
  dropClass: string
} {
  const move = useStore((s) => s.move)
  const [over, setOver] = useState<DropPos | null>(null)
  return {
    dropClass: over ? ` drop-${over}` : '',
    rowProps: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes('application/x-apiclient-item')) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        const upper = e.clientY - rect.top < rect.height * 0.35
        setOver(mode === 'inside-only' ? 'inside' : mode === 'before-only' || upper ? 'before' : 'inside')
      },
      onDragLeave: () => setOver(null),
      onDrop: (e) => {
        e.preventDefault()
        const dragId = e.dataTransfer.getData('application/x-apiclient-item')
        const pos = over ?? 'inside'
        setOver(null)
        if (dragId) move(dragId, id, pos === 'after' ? 'inside' : pos)
      }
    }
  }
}

function CollectionNode({ c, q, openMenu }: { c: Collection; q: string; openMenu: OpenMenu }): React.JSX.Element | null {
  const expanded = useStore((s) => s.expanded[c.id])
  const toggle = useStore((s) => s.toggleExpanded)
  const renaming = useStore((s) => s.renamingId === c.id)
  const { rowProps, dropClass } = useDnd(c.id, 'inside-only')
  const moveCollection = useStore((s) => s.moveCollection)
  const [colOver, setColOver] = useState<'before' | 'after' | null>(null)
  const [dragging, setDragging] = useState(false)
  const visible = q ? c.items.filter((i) => matches(i, q)) : c.items
  if (q && !visible.length && !c.name.toLowerCase().includes(q)) return null
  const open = expanded || !!q

  return (
    <div className="node">
      <div
        className={
          'row collection-row' +
          (c.isDefault ? ' default-collection' : '') +
          (colOver ? ' drop-' + colOver : dropClass) +
          (dragging ? ' dragging' : '')
        }
        draggable={!renaming && !q}
        onDragStart={(e) => {
          e.dataTransfer.setData(COLLECTION_DND, c.id)
          e.dataTransfer.effectAllowed = 'move'
          setDragging(true)
        }}
        onDragEnd={() => setDragging(false)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(COLLECTION_DND)) {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            setColOver(e.clientY - rect.top < rect.height / 2 ? 'before' : 'after')
          } else rowProps.onDragOver?.(e)
        }}
        onDragLeave={(e) => {
          setColOver(null)
          rowProps.onDragLeave?.(e)
        }}
        onDrop={(e) => {
          const dragId = e.dataTransfer.getData(COLLECTION_DND)
          if (dragId) {
            e.preventDefault()
            const pos = colOver ?? 'before'
            setColOver(null)
            moveCollection(dragId, c.id, pos)
          } else rowProps.onDrop?.(e)
        }}
        onClick={() => toggle(c.id)}
        onContextMenu={(e) => openMenu(e, c.id, 'collection')}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        {c.isDefault ? <InboxIcon /> : <CollectionIcon />}
        {renaming ? <RenameInput id={c.id} initial={c.name} /> : <span className="name">{c.name}</span>}
        <button className="row-menu" onClick={(e) => openMenu(e, c.id, 'collection')}>
          ⋯
        </button>
      </div>
      {open && (
        <div className="children">
          {visible.length === 0 && !q && <div className="empty-child">Vazia — clique em ⋯ para adicionar</div>}
          {visible.map((i) => (
            <ItemNode key={i.id} item={i} q={q} openMenu={openMenu} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemNode({ item, q, openMenu }: { item: Item; q: string; openMenu: OpenMenu }): React.JSX.Element {
  const expanded = useStore((s) => s.expanded[item.id])
  const toggle = useStore((s) => s.toggleExpanded)
  const openRequest = useStore((s) => s.openRequest)
  const active = useStore((s) => s.activeTabId === item.id)
  const renaming = useStore((s) => s.renamingId === item.id)
  const { rowProps, dropClass } = useDnd(item.id, item.type === 'folder' ? 'both' : 'before-only')

  const drag = {
    draggable: !renaming,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-apiclient-item', item.id)
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  if (item.type === 'request') {
    return (
      <div
        className={'row' + (active ? ' active' : '') + dropClass}
        {...drag}
        {...rowProps}
        onClick={() => openRequest(item.id)}
        onContextMenu={(e) => openMenu(e, item.id, 'request')}
        title={item.url}
      >
        <span className={'method-badge m-' + item.method}>{item.method === 'DELETE' ? 'DEL' : item.method}</span>
        {renaming ? <RenameInput id={item.id} initial={item.name} /> : <span className="name">{item.name}</span>}
        <button className="row-menu" onClick={(e) => openMenu(e, item.id, 'request')}>
          ⋯
        </button>
      </div>
    )
  }

  const visible = q ? item.items.filter((i) => matches(i, q)) : item.items
  const open = expanded || !!q
  return (
    <div className="node">
      <div
        className={'row' + dropClass}
        {...drag}
        {...rowProps}
        onClick={() => toggle(item.id)}
        onContextMenu={(e) => openMenu(e, item.id, 'folder')}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        <FolderIcon />
        {renaming ? <RenameInput id={item.id} initial={item.name} /> : <span className="name">{item.name}</span>}
        <button className="row-menu" onClick={(e) => openMenu(e, item.id, 'folder')}>
          ⋯
        </button>
      </div>
      {open && (
        <div className="children">
          {visible.length === 0 && !q && <div className="empty-child">Pasta vazia</div>}
          {visible.map((i) => (
            <ItemNode key={i.id} item={i} q={q} openMenu={openMenu} />
          ))}
        </div>
      )}
    </div>
  )
}

function RenameInput({ id, initial }: { id: string; initial: string }): React.JSX.Element {
  const rename = useStore((s) => s.rename)
  const setRenaming = useStore((s) => s.setRenaming)
  const [value, setValue] = useState(initial)
  return (
    <input
      className="rename-input"
      autoFocus
      value={value}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => rename(id, value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') rename(id, value)
        if (e.key === 'Escape') setRenaming(null)
      }}
    />
  )
}

function ContextMenu({ menu }: { menu: MenuState }): React.JSX.Element {
  const s = useStore.getState()
  const items: [string, () => void, string?][] = []
  if (menu.kind !== 'request') {
    items.push(['Nova requisição', () => s.addRequest(menu.id)])
    items.push(['Nova pasta', () => s.addFolder(menu.id)])
  } else {
    items.push(['Abrir', () => s.openRequest(menu.id)])
  }
  if (menu.kind === 'collection') {
    items.push(['Auth e headers da coleção', () => s.openCollectionSettings(menu.id)])
    items.push(['Exportar...', () => s.exportCollection(menu.id)])
    const idx = s.data.collections.findIndex((c) => c.id === menu.id)
    if (idx > 0) items.push(['Mover para cima', () => s.moveCollectionBy(menu.id, -1)])
    if (idx < s.data.collections.length - 1) items.push(['Mover para baixo', () => s.moveCollectionBy(menu.id, 1)])
  }
  items.push(['Renomear', () => s.setRenaming(menu.id)])
  items.push(['Duplicar', () => s.duplicate(menu.id)])
  items.push(['Excluir', () => s.remove(menu.id), 'danger'])

  const top = Math.min(menu.y, window.innerHeight - items.length * 30 - 16)
  return (
    <div className="context-menu" style={{ left: menu.x, top }} onClick={(e) => e.stopPropagation()}>
      {items.map(([label, fn, cls]) => (
        <button
          key={label}
          className={cls}
          onClick={() => {
            window.dispatchEvent(new Event('click'))
            fn()
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
