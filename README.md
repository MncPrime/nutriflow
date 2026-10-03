# NutriFlow

Nutri Flow - Planejamento Alimentar em Ação

## Desenvolvimento

```sh
npm run dev
```

O Tailwind CSS é processado pelo Vite a partir de `src/style.css`. Para gerar a
versão de produção em `dist/`, execute `npm run build`.

## Fluxo de mudanças e publicação

- `npm run dev` abre uma prévia local em `http://127.0.0.1:5173`; ela pode conter
  mudanças ainda não publicadas.
- Crie uma branch por mudança a partir de `main`, por exemplo
  `feat/importador-pdf`, `fix/cache-offline`, `docs/fluxo-publicacao` ou
  `chore/ci-workflows`. Mudanças paralelas usam branches separadas; não trabalhe
  diretamente em `main`.
- Use mensagens no formato `tipo(escopo): resumo`, com tipos como `feat`, `fix`,
  `docs`, `test`, `refactor` e `chore`. Exemplos:
  `feat(importador): reconhece rotinas do PDF` e
  `fix(sw): atualiza cache da aplicação`.
- Envie a branch e abra um PR para `main`. O workflow de PR executa `npm test` e
  `npm run build`; ambos precisam passar antes do merge.
- Dê ao PR um título no mesmo formato de commit e use **Squash and merge** para
  manter o histórico de `main` com uma mensagem clara por mudança.
- O site real, `https://mncprime.github.io/nutriflow/`, só é publicado pelo
  workflow de Pages após um push em `main` (normalmente, o merge do PR). Branches
  e PRs não publicam o site. Configure uma regra de proteção para `main` exigir
  PR e o job **Tests & Build** do workflow **Pull Request Checks**. Em
  **Settings → Rules → Rulesets**, crie uma regra para `main` com PR obrigatório
  e esse check como status obrigatório.

Consulte [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) para o fluxo completo e
[VERSIONING.md](./VERSIONING.md) para releases, snapshots e rollback.

Para confirmar qual versão chegou ao site, abra **Actions → Deploy GitHub Pages**,
confira a execução concluída mais recente e o SHA exibido em **Commit publicado**.
No console do navegador, compare
`document.querySelector('meta[name="build-commit"]')?.content` com os primeiros
7 caracteres do SHA publicado. O valor `local` identifica uma prévia local,
não um deploy.

Se o navegador ainda mostrar a versão anterior, confirme primeiro que a execução
de Pages terminou com sucesso e compare os SHAs. Atualize a página; no app
instalado, feche-o completamente e abra-o novamente enquanto estiver online.
Se necessário, atualize ou remova o service worker nas ferramentas do navegador
e recarregue o site online. **Não limpe os dados do site**, pois isso pode apagar
o plano alimentar salvo localmente.

O deploy do GitHub Pages é feito pela GitHub Action em
`.github/workflows/pages.yml`. Nas configurações do repositório, selecione
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Catálogo comercial e orçamento

O frontend usa somente as credenciais públicas do Supabase:

```sh
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Crie `.env.local` para desenvolvimento local (o arquivo é ignorado pelo Git).
No GitHub, cadastre ambas como **Repository variables** (`Settings → Secrets and
variables → Actions → Variables`); o workflow injeta os valores apenas no passo
de build e falha com uma mensagem explícita se estiverem ausentes.
Nunca use `service_role` em `VITE_*`, no HTML, no JavaScript do navegador ou em
variáveis públicas do GitHub Pages.

### Preparar o Supabase

1. Revise e aplique as migrations versionadas em `supabase/migrations/` ao
   projeto correto. A migration `20261002030000_protect_public_prices.sql`
   remove a leitura pública de preços unitários/configuração financeira e cria a
   fila remota de validação de alimentos; ela não foi aplicada automaticamente.
2. Mantenha a autorização admin baseada em `app_metadata.role = 'admin'`.
   RLS deve permanecer habilitada para todas as tabelas comerciais.
   Para login e recuperação de senha, configure em **Authentication → URL
   Configuration** o Site URL `https://mncprime.github.io/nutriflow/`. Contas
   administrativas precisam existir em Authentication → Users e receber
   `role: admin` em `app_metadata`; o app nunca concede essa função por conta
   própria. Na tela Admin, **Esqueci minha senha** envia o link pelo fluxo de
   recuperação do Supabase.
3. Implante `supabase/functions/commercial-quote/`. A Edge Function usa
   `SUPABASE_SERVICE_ROLE_KEY` somente no runtime Supabase para ler preços e
   calcular a cotação. Essa chave nunca deve ser enviada ao navegador.
4. Configure `CORS_ALLOWED_ORIGINS` na função com a origem de produção e as
   origens locais necessárias, separadas por vírgula. O padrão inclui
   `https://mncprime.github.io`, `localhost:5173` e `127.0.0.1:5173`.
5. O app sincroniza apenas nomes, unidades e fatores de cocção para IndexedDB.
   Preços e parâmetros financeiros são consultados pela função de orçamento.
   Offline, o app pode reutilizar snapshots agregados previamente salvos; um
   ciclo novo/alterado sem conexão permanece provisório até reconectar.

Para publicar a Edge Function pelo GitHub Actions, adicione o secret de
repositório `SUPABASE_ACCESS_TOKEN` e execute manualmente o workflow
**Deploy commercial quote function**. O projeto fornece `SUPABASE_SERVICE_ROLE_KEY`
à função no runtime; não cadastre essa chave no GitHub nem no frontend. O
workflow fica disponível para execução após ser integrado à branch padrão.

Na atualização, a migration do IndexedDB remove preços individuais de
catálogos e cotações antigas. O service worker v13 também limpa o cache HTTP
antigo de respostas Supabase; somente o catálogo seguro e snapshots agregados
continuam disponíveis offline.

O leitor PDF.js é preparado enquanto há conexão e o service worker está ativo;
assim, os arquivos locais do motor ficam no cache para extração de PDFs offline.
O importador reconhece localmente o layout tabular deste modelo de plano e pede
que se escolha entre as rotinas de horário identificadas antes da revisão. A
extração continua sujeita à conferência e não envia o PDF a serviços externos.

O parâmetro `show_food_prices` controla a visibilidade dos preços individuais e
da decomposição interna (custos agregados de alimentos, confecção, markup e taxa).
Com a opção desativada, o cliente ainda recebe preço final do ciclo e valor por
marmita, mas não a composição comercial interna. B2B (tenants, volume,
recorrência e exportação) ainda não está definido nem incluído.

As solicitações de alimentos novos são guardadas localmente quando offline e
enviadas à fila Supabase ao reconectar. O plano alimentar permanece fonte da
verdade; solicitações não inserem nem alteram alimentos do plano.

Execute `npm test` e `npm run build` para validar as regras e a aplicação.
