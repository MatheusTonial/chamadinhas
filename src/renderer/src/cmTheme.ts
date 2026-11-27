// Tema "Terraform" para os editores CodeMirror (body e resposta).
// Usa as variáveis CSS definidas em styles.css — não espalhar hex aqui.
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-secondary)' },
  '.cm-content': { caretColor: 'var(--color-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-primary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-selection) !important'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface-sunken)',
    color: 'var(--color-tertiary)',
    borderRight: '1px solid var(--color-border)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-hover)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-hover)',
    border: 'none',
    color: 'var(--color-tertiary)'
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--color-selection)', outline: 'none' }
})

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--color-primary)' },
  { tag: t.string, color: 'var(--color-success)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--color-info)' },
  { tag: [t.punctuation, t.bracket, t.separator], color: 'var(--color-tertiary)' },
  { tag: t.invalid, color: 'var(--color-error)' }
])

export const terraformEditor = [editorTheme, syntaxHighlighting(highlight)]
