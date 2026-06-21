# Manufacturing.AI — Playbook de Desenvolvimento

Guia completo de tudo que foi aplicado neste projeto para replicar em novos projetos.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| Frontend | HTML + CSS + Vanilla JS | Zero build step, carrega instantâneo, sem dependências pesadas |
| Backend | Python `http.server` + WSGI | Já vem no Python, sem instalar nada pra dev local |
| Banco | SQLite | Arquivo único, zero config, perfeito pra MVP e apps leves |
| Deploy | Render (free tier) | Deploy automático via GitHub, suporta Python + SQLite |
| Ícones | Lucide Icons (CDN) | Leve, consistente, boa cobertura de ícones |
| Fonte | Plus Jakarta Sans (Google Fonts) | Moderna, pesos variados, boa legibilidade |
| Produção | Gunicorn (WSGI) | Server de produção para Python, exigido pelo Render |

---

## 2. Estrutura de Arquivos

```
projeto/
├── index.html          # HTML principal (SPA-like, sidebar + conteúdo dinâmico)
├── styles.css          # CSS completo com design tokens (variáveis)
├── app.js              # Lógica frontend: navegação, DataTable, filtros, render
├── server.py           # Backend: API JSON + serving de arquivos estáticos
├── database.sql        # Schema DDL do SQLite
├── seed_db.py          # Script de seed (popular dados iniciais)
├── init_db.py          # Script simples pra criar banco vazio
├── manufacturing.db    # Banco SQLite (gerado pelo seed)
├── requirements.txt    # Dependências Python (gunicorn)
├── render.yaml         # Blueprint do Render (opcional)
├── .gitignore          # Ignora __pycache__, .claude/
└── PLAYBOOK.md         # Este documento
```

---

## 3. Design System

### 3.1 Variáveis CSS (Design Tokens)

Todas as cores e estilos são controlados por variáveis no `:root`. Isso permite trocar o tema inteiro mudando poucas linhas.

```css
:root {
  --bg: #f4f7f8;           /* fundo geral */
  --panel: #ffffff;         /* fundo de cards/painéis */
  --ink: #23272f;           /* texto principal */
  --muted: #667084;         /* texto secundário */
  --line: #dbe2e8;          /* bordas */
  --line-strong: #c6d0da;   /* bordas hover */
  --teal: #0f766e;          /* cor primária (CTA, active states) */
  --teal-soft: #d9f2ee;     /* background de tags teal */
  --coral: #c84622;         /* alertas, overdue */
  --coral-soft: #ffe3d8;
  --amber: #b7791f;         /* warnings, pending */
  --amber-soft: #fff0c2;
  --violet: #5b5bd6;        /* in_production, categorias */
  --violet-soft: #e6e7ff;
  --green: #22885d;         /* sucesso, closed */
  --green-soft: #dcf6e9;
  --shadow: 0 18px 48px rgba(44, 54, 68, 0.12);
  --shadow-sm: 0 2px 8px rgba(44, 54, 68, 0.08);
}
```

### 3.2 Layout Grid

Sidebar fixa (272px) + conteúdo flexível. Responsivo com media queries.

```css
.installer {
  display: grid;
  grid-template-columns: 272px 1fr;
  height: 100vh;
}
```

### 3.3 Sidebar Escura

Fundo `#0e1117`, texto `#eaf0f2`, links com hover sutil e active com fundo teal transparente.

### 3.4 Componentes Reutilizáveis

- **`.kpi-card`** — Card de métrica com label, valor grande e indicador de variação
- **`.section-panel`** — Painel branco com header e conteúdo (tabelas, etc)
- **`.data-table`** — Tabela estilizada com hover, headers uppercase
- **`.tag`** + variantes — Tags coloridas (`.tag-teal`, `.tag-amber`, `.tag-coral`, `.tag-violet`, `.tag-green`, `.tag-muted`)
- **`.cta`** — Botão primário (fundo teal, texto branco)
- **`.ghost-btn`** — Botão secundário (borda, fundo branco)
- **`.contact-avatar`** — Avatar circular com iniciais coloridas

---

## 4. Componente DataTable

Sistema genérico de tabela com filtros e reordenação de colunas. Pode ser reutilizado em qualquer projeto.

### 4.1 Como Usar

```javascript
DataTable(containerElement, {
  tableName: "nome_da_tabela",
  data: arrayDeObjetos,
  columns: [
    { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>` },
    { key: "name", label: "Nome" },
    { key: "price", label: "Preço", numeric: true, render: (v) => `R$ ${fmt(v)}`, rawValue: (v) => v },
  ],
});
```

### 4.2 Propriedades de Coluna

| Prop | Tipo | Descrição |
|------|------|-----------|
| `key` | string | Chave do objeto de dados |
| `label` | string | Texto do header |
| `render(val, row)` | function | HTML customizado para a célula |
| `rawValue(val, row)` | function | Valor real para filtros (quando render mostra formatado) |
| `numeric` | boolean | Alinha à direita |

### 4.3 Filtros

Cada coluna tem:
- **Input de texto** com autocomplete baseado nos valores existentes
- **Seletor de modo** (12 modos): contains, not_contains, equals, not_equals, starts_with, ends_with, gt, lt, gte, lte, empty, not_empty
- **Botão clear** para limpar filtro individual
- **Sugestões** com highlight do match

### 4.4 Reordenação de Colunas

- Drag and drop nativo do HTML5
- Ícone grip (⋮⋮) em cada header
- Visual feedback com highlight teal na coluna destino

---

## 5. Backend / API

### 5.1 Padrão de Rotas

Dicionário simples de rota → SQL query. Sem framework, sem ORM.

```python
ROUTES = {
    "/api/customers": "SELECT * FROM customers ORDER BY id",
    "/api/sales": """
        SELECT sh.id, c.name as customer_name, ss.name as status, sh.total_price
        FROM sales_header sh
        JOIN customers c ON c.id = sh.customer_id
        JOIN sales_status ss ON ss.id = sh.status_id
        ORDER BY sh.id
    """,
}
```

### 5.2 WSGI + Dev Server Dual Mode

O `server.py` funciona de duas formas:
- **Dev local**: `python server.py` → usa `http.server` na porta 8080
- **Produção**: `gunicorn server:app` → usa a função WSGI `app()`

```python
# WSGI app (produção)
def app(environ, start_response):
    ...

# Dev server (local)
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    server = http.server.HTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()
```

### 5.3 Segurança: Whitelist de Arquivos Estáticos

Nunca servir arquivos arbitrários. Whitelist explícita:

```python
STATIC_FILES = ("index.html", "styles.css", "app.js")
```

---

## 6. Banco de Dados

### 6.1 Schema Pattern

- IDs com `AUTOINCREMENT`
- Foreign keys explícitas
- Colunas calculadas com `GENERATED ALWAYS AS ... STORED`
- Defaults sensatos (`datetime('now')`, `'open'`, etc)

```sql
CREATE TABLE sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_header_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
    due_date TEXT,
    FOREIGN KEY (sales_header_id) REFERENCES sales_header(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
```

### 6.2 Seed Script Pattern

Script Python que:
1. Deleta o banco antigo se existir
2. Executa o DDL (`database.sql`)
3. Insere dados via `executemany`
4. Calcula totais via `UPDATE ... subquery`
5. Printa resumo para verificação

### 6.3 Modelo de Dados Usado

```
customers ──┐
             ├──> sales_header ──> sales_items <── materials
sales_status ┘
resources (independente)
```

---

## 7. Performance

### 7.1 Frontend

| Técnica | Detalhes |
|---------|----------|
| Cache de API | Respostas cacheadas em memória (`const cache = {}`) — evita re-fetch |
| Timer de load | `performance.now()` mede e exibe tempo de cada seção |
| Lucide async | Ícones carregam em paralelo sem bloquear dados (`async + onload`) |
| Safe icons | `safeIcons()` verifica se Lucide existe antes de chamar — sem erros se CDN atrasar |
| Versão fixa CDN | `lucide@0.460.0` em vez de `@latest` — evita resolução lenta de versão |
| Sem framework | Zero bundle, zero build step — HTML/CSS/JS puro carrega em <50ms |
| Fonte preconnect | `<link rel="preconnect">` para Google Fonts acelera DNS/TLS |

### 7.2 Backend

| Técnica | Detalhes |
|---------|----------|
| JOINs no SQL | Dados chegam prontos no frontend, sem N+1 queries |
| SQLite in-process | Sem conexão de rede ao banco — leitura em microsegundos |
| Sem ORM | Query SQL direta — sem overhead de abstração |
| `row_factory = Row` | Converte direto para dict, sem loop manual |
| Gunicorn sync worker | Suficiente para SQLite (single writer) |

### 7.3 Deploy

| Técnica | Detalhes |
|---------|----------|
| Build inclui seed | `pip install && python seed_db.py` — banco pronto no deploy |
| Arquivo .db no repo | SQLite é portátil — não precisa de serviço externo de banco |
| Whitelist de arquivos | Serve apenas 3 arquivos estáticos — sem risk de path traversal |

---

## 8. Deploy no Render

### 8.1 Pré-requisitos

- Repositório no GitHub (público ou privado)
- Conta no Render (login via GitHub)

### 8.2 Arquivos Necessários

**`requirements.txt`**
```
gunicorn==22.0.0
```

**`render.yaml`** (opcional, o Render detecta Python automaticamente)
```yaml
services:
  - type: web
    name: manufacturing-ai
    runtime: python
    buildCommand: pip install -r requirements.txt && python seed_db.py
    startCommand: gunicorn server:app --bind 0.0.0.0:$PORT
```

### 8.3 Configuração no Dashboard

| Campo | Valor |
|-------|-------|
| Build Command | `pip install -r requirements.txt && python seed_db.py` |
| Start Command | `gunicorn server:app --bind 0.0.0.0:$PORT` |
| Instance Type | Free |

### 8.4 Notas do Free Tier

- Dorme após 15 minutos sem requests
- Primeiro acesso após dormir demora ~30 segundos
- Auto-deploy em cada `git push`
- SQLite funciona, mas o filesystem é efêmero (dados resetam a cada deploy)

---

## 9. Ferramentas de Desenvolvimento

### 9.1 Dev Local

```bash
# Criar/recriar banco
python seed_db.py

# Rodar servidor local
python server.py
# Acessa em http://localhost:8080
```

### 9.2 Git + Deploy

```bash
# Commitar mudanças
git add -A
git commit -m "descrição da mudança"
git push
# Render faz redeploy automático
```

### 9.3 GitHub CLI

```bash
# Instalar
winget install GitHub.cli

# Login
gh auth login --hostname github.com --web

# Criar repo
gh repo create NomeDoProjeto --public
```

---

## 10. Checklist para Novo Projeto

- [ ] Copiar `styles.css` (design tokens + componentes)
- [ ] Copiar função `DataTable` do `app.js`
- [ ] Copiar estrutura do `server.py` (WSGI + dev dual mode)
- [ ] Criar `database.sql` com schema
- [ ] Criar `seed_db.py` com dados iniciais
- [ ] Criar `index.html` com sidebar + stage-body
- [ ] Criar `requirements.txt` com `gunicorn`
- [ ] Criar `.gitignore`
- [ ] `python seed_db.py` para gerar banco
- [ ] `python server.py` para testar local
- [ ] `git init && git add . && git commit && git push`
- [ ] Deploy no Render

---

## 11. Melhorias Futuras

### Performance
- Service Worker para cache offline
- Compressão gzip no server (middleware)
- Lazy loading de seções (só carrega API quando clica na aba)
- Virtual scrolling para tabelas com muitos registros (>1000 rows)
- SQLite WAL mode para reads mais rápidos

### Funcionalidades
- CRUD completo (criar, editar, deletar registros via API POST/PUT/DELETE)
- Autenticação (login/senha ou OAuth)
- Export para CSV/Excel
- Gráficos com Chart.js ou D3
- Dark mode (as variáveis CSS já facilitam)
- Busca global (across all tables)
- Paginação server-side para datasets grandes
- Websockets para atualização em tempo real

### Infraestrutura
- PostgreSQL em vez de SQLite (para dados persistentes no Render)
- Docker para deploy consistente
- CI/CD com GitHub Actions (lint, testes)
- Domínio customizado no Render
- Monitoramento com health check endpoint (`/api/health`)
- Rate limiting nas APIs
- CORS headers se frontend separado do backend

### Mobile
- Layout responsivo melhorado (sidebar colapsável)
- Touch-friendly filters (dropdowns maiores)
- PWA (Progressive Web App) com manifest.json
- Pull-to-refresh
