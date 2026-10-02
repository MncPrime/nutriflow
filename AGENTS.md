# NutriFlow: contexto do projeto

PWA offline, mobile first, tema claro e escuro. Transforma o plano alimentar de um
nutricionista em marmitas planejadas, converte peso cozido em peso cru e gera a
lista de compras com custos. Publicado no GitHub Pages (https://mncprime.github.io/nutriflow/).

## Arquivos
- `index.html`: estrutura e lógica do app; os estilos específicos do app continuam inline.
- `src/style.css`: entrada do Tailwind CSS, processada pelo Vite.
- `public/sw.js`: service worker. Rede primeiro, cache como fallback offline.
- `public/manifest.webmanifest` e `public/icon.svg`: instalação como PWA.

O Vite processa o CSS e serve o app em desenvolvimento (`npm run dev`); use
`npm run build` para gerar a versão de produção. O service worker exige HTTPS
ou localhost.

## Regras de negócio (invioláveis)
1. O plano do nutricionista é a fonte da verdade. O app nunca cria, troca ou
   remove alimentos nem altera quantidades por conta própria. O usuário só
   pode marcar ou desmarcar o que já está no plano.
2. Fatores de cocção (cru = pronto ÷ fator), em `CATS`:
   proteína 0,75 · arroz 2,5 · feijão 2,8 · macarrão 2,2 · tubérculos,
   legumes e demais itens 1,0.
3. O app não depende de chamadas de rede, CDN ou fontes externas em runtime.
   Vite e Tailwind são ferramentas de build, não dependências de runtime.

## Modelo de dados
O plano é texto (campo `S.text`) interpretado por `parsePlan`:
- `# Refeição | hora` abre uma refeição.
- `## Nome` abre uma opção dentro da refeição (ex.: Opção 1, 2, 3 dos lanches).
  Refeições sem `##` têm uma opção única.
- Cada linha é um componente. Alternativas ficam separadas por " ou ".
  Alternativa sem quantidade herda a quantidade da anterior.
- Quantidade: `150g nome`, `2 un nome` ou `2 fatias nome`. Aceita fração (`1/2`).
- Linhas sem dígito são ignoradas (ex.: "salada crua à vontade").

Estrutura em memória: refeição → opções → componentes → alternativas
(`{name, g, n, cat}`; `g` em gramas ou `n` em unidades).

Categorias (`cat`) vêm de `KW` por palavras-chave: ovo, supl, arroz, feijao, mac,
tub, prot, out. A ordem de `KW` importa (a primeira que casa vence).

## Estado e persistência
- `localStorage`, chave `nf2`. Objeto `S`: `text, days, mode, budget, tab, theme,
  off, moff, prices`.
- `off`: alternativas e opções desligadas, por caminho `mi.oi.ci.ai`.
  `moff`: refeições desligadas. `prices`: preço por nome do item.
- `off` e `moff` usam índices. Ao reler o plano (`doParse`) eles são zerados.

## Lógica de planejamento (`plan()`)
- Almoço e jantar (nome casa com `/almo|jantar/`) viram marmitas: uma por dia.
- Outras refeições alternam as opções ativas por dia (`d % opções`).
- Alternativas: modo "variar" divide o ciclo em blocos contíguos por alternativa;
  modo "economizar" escolhe a de menor custo (`cst`).
- Itens são agregados por nome + modo (g ou un); todos os ovos viram "Ovo de galinha".
- Compra arredondada para cima por embalagem (`CATS[cat].s`, em gramas; ovos em dúzias;
  itens em unidade, para cima).
- Custo por marmita = custo dos itens de marmita rateado pela fração usada nelas.

## Convenções
- Mobile first, alvos de toque de pelo menos 44 px, foco visível.
- Tema por variáveis CSS; redefinir em `prefers-color-scheme` e em
  `[data-theme=dark]`. Nunca usar cores fixas fora das variáveis.
- Texto da interface em português do Brasil.
- Qualquer leitura ou escrita em `localStorage` fica dentro de try/catch.
- Ao mudar a lógica de instalação/ativação do service worker, aumentar a versão `V`.
  A instalação pré-carrega o HTML e os recursos locais referenciados nele.

## Limitações conhecidas (candidatas a auditoria)
- Preços iniciais são estimativas fixas em `DEFP` e `CATS`.
- Lanches e suplementos entram como consumo por dia × dias do ciclo.
- A detecção de categoria por palavra-chave pode errar em nomes novos
  (cai em `out`, fator 1,0, o que subestima o cru de proteínas e grãos).
- Não há leitura de PDF ou imagem; o plano é digitado ou colado como texto.
- Sem testes automatizados. Validar mudanças de cálculo com o plano de exemplo
  (`DEF`) e conferir o total do ciclo antes e depois.

## Como trabalhar neste projeto
- Antes de alterar cálculo ou parser, descreva o plano de mudança e aguarde aprovação.
- Faça mudanças pequenas, em branch próprio, e mostre o diff.
- Não adicione dependências de runtime nem recursos que exijam rede.
