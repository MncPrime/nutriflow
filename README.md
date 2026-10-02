# NutriFlow

Nutri Flow - Planejamento Alimentar em Ação

## Desenvolvimento

```sh
npm run dev
```

O Tailwind CSS é processado pelo Vite a partir de `src/style.css`. Para gerar a
versão de produção em `dist/`, execute `npm run build`.

O deploy do GitHub Pages é feito pela GitHub Action em `.github/workflows/pages.yml`.
Nas configurações do repositório, selecione **Settings → Pages → Build and deployment
→ Source: GitHub Actions**.

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
catálogos e cotações antigas. O service worker v10 também limpa o cache HTTP
antigo de respostas Supabase; somente o catálogo seguro e snapshots agregados
continuam disponíveis offline.

O parâmetro `show_food_prices` controla a visibilidade dos preços individuais e
da decomposição interna (custos agregados de alimentos, confecção, markup e taxa).
Com a opção desativada, o cliente ainda recebe preço final do ciclo e valor por
marmita, mas não a composição comercial interna. B2B (tenants, volume,
recorrência e exportação) ainda não está definido nem incluído.

As solicitações de alimentos novos são guardadas localmente quando offline e
enviadas à fila Supabase ao reconectar. O plano alimentar permanece fonte da
verdade; solicitações não inserem nem alteram alimentos do plano.

Execute `npm test` e `npm run build` para validar as regras e a aplicação.
