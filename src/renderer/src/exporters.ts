// Exportação para arquivo .json: tudo de uma vez (coleções + ambientes) ou um ambiente sozinho.
// O formato é reconhecido pelo Importar do próprio app.
import type { Auth, Collection, Environment, Item } from '../../shared/types'

export interface ExportFile {
  chamadinhasExport: 1
  exportedAt: string
  /** true quando valores de variáveis e senhas/tokens foram apagados */
  secretsRemoved: boolean
  collections: Collection[]
  environments: Environment[]
}

export function buildExport(
  collections: Collection[],
  environments: Environment[],
  removeSecrets: boolean
): ExportFile {
  const cols = structuredClone(collections)
  const envs = structuredClone(environments)
  if (removeSecrets) {
    cols.forEach(stripCollection)
    envs.forEach((e) => e.variables.forEach((v) => (v.value = '')))
  }
  return {
    chamadinhasExport: 1,
    exportedAt: new Date().toISOString(),
    secretsRemoved: removeSecrets,
    collections: cols,
    environments: envs
  }
}

/** Apaga só o que é segredo da autenticação; mantém o tipo e o nome do usuário/chave. */
function stripAuth(a: Auth): void {
  if (a.type === 'bearer') a.token = ''
  else if (a.type === 'basic') a.password = ''
  else if (a.type === 'apikey') a.value = ''
}

function stripItems(items: Item[]): void {
  for (const i of items) {
    if (i.type === 'request') stripAuth(i.auth)
    else stripItems(i.items)
  }
}

function stripCollection(c: Collection): void {
  stripAuth(c.auth)
  stripItems(c.items)
}

/** Nome de arquivo com a data de hoje, ex.: chamadinhas-2026-11-06.json */
export function datedName(prefix: string): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}
