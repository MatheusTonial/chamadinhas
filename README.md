# Chamadinhas

Cliente HTTP desktop simples (substituto do Postman) feito com Electron + React.

## Recursos
- Métodos GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Params (sincronizados com a URL), headers, body (JSON, texto, urlencoded, form-data)
- Autenticação: Bearer, Basic, API Key (header ou query) — por requisição ou herdada da coleção
- Coleções e pastas (criar, renomear, duplicar, excluir, arrastar e soltar); coleções podem ser reordenadas arrastando ou pelo menu ⋯ (Mover para cima/baixo)
- Headers e auth no nível da coleção (⋯ → "Auth e headers da coleção")
- **Exportar tudo** (botão Exportar): todas as coleções e ambientes num único .json, com opção de remover segredos (valores de variáveis, tokens, senhas e API keys) para compartilhar
- Exportar uma coleção (menu ⋯) ou um ambiente (tela Ambientes) em JSON
- **Importar** (botão Importar): coleções do Postman v2.0/v2.1, ambientes/globais do Postman e qualquer arquivo exportado pelo Chamadinhas (coleção, ambiente ou Exportar tudo) — vários arquivos de uma vez, com resumo e avisos
- Ambientes com variáveis `{{nome}}` (URL, headers, auth, body). Botão **Ambientes** / **?** no topo direito abre o editor e o guia "Como usar variáveis"
- Requisições avulsas (botão "+ Requisição" ou Ctrl+N) ficam na coleção automática "Sem coleção"
- Modo claro/escuro (botão de lua/sol na barra lateral), ambos no Terraform Theme
- Atalhos: Ctrl+N nova requisição · Ctrl+Enter enviar · Ctrl+S salvar · Ctrl+W fechar aba · Ctrl+Tab trocar aba

Os dados ficam em `%APPDATA%\Chamadinhas\data.json` (com backup `data.json.bak`).
Erros do app são registrados em `%APPDATA%\Chamadinhas\app.log`.

## Desenvolvimento
```bash
npm install
npm run dev        # abre o app com hot reload
npm run build:win  # gera o instalador em dist/
```

Para testes automatizados de importação, `CHAMADINHAS_IMPORT_FILES="a.json;b.json"` faz o botão Importar usar esses arquivos sem abrir o seletor, e `CHAMADINHAS_EXPORT_DIR=<pasta>` faz as exportações gravarem direto nessa pasta.
```bash
```

## Ícone
O ícone fica em `build/icon.svg` (cópia usada na interface em `src/renderer/src/assets/logo.svg`).
Depois de editar o SVG, gere o PNG usado no instalador:
```bash
npm run icon
```
