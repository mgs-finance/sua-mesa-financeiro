# Controle Financeiro — Sua Mesa

Sistema de controle financeiro para a Sua Mesa (@sua_mesa_ / suamesaloja.com.br), cobrindo compra e venda de produtos e despesas operacionais do negócio: eventos/feiras, Uber, motoboy, costureira, marketing, embalagem e taxas de plataforma.

Roda inteiramente no navegador — sem servidor, sem cadastro, sem mensalidade. Os dados ficam salvos no `localStorage` do próprio navegador; use a aba **Backup** para exportar/importar.

## Funcionalidades

- **Dashboard** — receita líquida, custos + despesas, lucro líquido e margem do mês, com comparação automática ao mês anterior; evolução dos últimos 6 meses; despesas por categoria; produtos mais vendidos; alertas de estoque baixo.
- **Produtos** — cadastro com custo, preço de venda, margem calculada automaticamente, estoque e estoque mínimo.
- **Vendas** — por produto, canal (Site, Instagram, WhatsApp, Marketplace, Feira/Evento), com desconto e taxa de plataforma. O custo do produto é registrado (snapshot) no momento da venda, para o CMV ficar correto mesmo que o custo mude depois. Atalhos de um clique com os produtos (ordenados pelos mais vendidos), estoque disponível e total da venda calculados em tempo real, trava que impede vender mais do que o estoque disponível, e o formulário continua aberto após salvar — pronto para lançar a próxima venda em sequência.
- **Compras** — mercadoria para revenda, matéria-prima ou embalagem. Quando vinculada a um produto, atualiza o estoque e recalcula o **custo médio ponderado** automaticamente.
- **Despesas** — categorias: Eventos, Uber, Motoboy, Costureira, Marketing, Embalagem, Taxas de Plataforma, Outras.
- **DRE** — Receita Bruta → Deduções → Receita Líquida → CMV → Lucro Bruto → Despesas Operacionais (por categoria) → Lucro Líquido → Margem líquida. Período livre (mês atual, últimos 3 meses, ano inteiro ou datas customizadas).
- **Fluxo de Caixa** — entradas e saídas cronológicas com saldo acumulado, a partir de um saldo inicial informado.
- **Backup** — exporta backup completo em `.json`, exporta vendas e despesas em `.csv`, importa um backup e carrega dados de exemplo para teste.

## Como usar

Abra `index.html` em qualquer navegador — localmente ou publicado (GitHub Pages, Netlify, etc.). Não precisa de instalação nem de internet depois de carregado (o `Chart.js` já vem incluído em `vendor/`, sem depender de CDN externo).

Na aba **Backup**, clique em **Carregar exemplo** para ver o sistema funcionando com dados fictícios antes de começar a usar com os dados reais.

## Estrutura

```
index.html        shell da aplicação (layout, formulários, tabelas)
app.js            toda a lógica (dados, cálculos, gráficos, backup)
chart.min.js       Chart.js 4.4.4 (vendorizado localmente, na raiz)
manifest.json      manifesto PWA (ícone, nome, modo tela cheia)
icon-180.png, icon-192.png, icon-512.png   ícones do app
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes itens (`index.html`, `app.js`, `chart.min.js`, `manifest.json`, os ícones).
2. Em *Settings → Pages*, selecione a branch `main` e a pasta raiz (`/`).
3. O endereço público fica em `https://<seu-usuário>.github.io/<repositório>/`.

## Instalar como app no iPhone

1. Abra o link do GitHub Pages no **Safari** do iPhone (precisa ser no Safari — não funciona pelo Chrome no iOS).
2. Toque no ícone de **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela de Início**.
4. Confirme o nome e toque em **Adicionar**.

O ícone aparece na tela de início e abre em tela cheia, como um app nativo (sem a barra de endereço do Safari). Como os dados ficam no `localStorage` do próprio aparelho, use a aba **Backup** periodicamente para exportar e não perder os lançamentos.

## Observações contábeis

- O CMV usa o custo do produto **no momento da venda** (snapshot por item vendido), não o custo atual — evita distorção se o custo de compra mudar depois.
- O custo do produto é atualizado por **custo médio ponderado** a cada nova compra vinculada a ele.
- A DRE separa custo (CMV, ligado ao produto vendido) de despesa operacional (Eventos, Uber, Motoboy, Costureira etc., não ligada a um produto específico) — a mesma lógica de uma demonstração de resultado tradicional.
