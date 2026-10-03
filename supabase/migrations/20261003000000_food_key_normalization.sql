-- Canonical food identity: ignores accents, punctuation, plural and connectors
-- ("ovo mexido" = "ovos mexidos"). Mirrors foodKey() in src/utils/food-matching.js.
-- If existing rows collide under the new key, resolve the duplicates before applying.

create or replace function public.food_key(value text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(string_agg(
    case
      when length(t) <= 3 then t
      when t ~ '(oes|aes)$' then left(t, length(t) - 3) || 'ao'
      when t ~ 'ais$' then left(t, length(t) - 3) || 'al'
      when t ~ '(res|zes)$' then left(t, length(t) - 2)
      when t ~ 'ns$' then left(t, length(t) - 2) || 'm'
      when t ~ '[^s]s$' then left(t, length(t) - 1)
      else t
    end, ' ' order by ord), '')
  from regexp_split_to_table(
    btrim(regexp_replace(
      lower(translate(
        value,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
        'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
      )),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ' '
  ) with ordinality as parts(t, ord)
  where t <> '' and t not in ('de', 'da', 'do', 'das', 'dos', 'com', 'e',
    'alimento', 'alimentos', 'porcao', 'unidade', 'unidades', 'und', 'unid', 'qtd', 'quantidade', 'tipo', 'opcao');
$$;

alter table public.foods drop constraint foods_name_unique_per_business;
alter table public.foods drop column normalized_name;
alter table public.foods
  add column normalized_name text generated always as (public.food_key(canonical_name)) stored,
  add constraint foods_name_unique_per_business unique (business_id, normalized_name);

alter table public.food_aliases drop constraint food_aliases_unique_per_business;
alter table public.food_aliases drop column normalized_alias;
alter table public.food_aliases
  add column normalized_alias text generated always as (public.food_key(alias)) stored,
  add constraint food_aliases_unique_per_business unique (business_id, normalized_alias);

alter table public.food_validation_requests drop constraint food_validation_requests_unique_name;
alter table public.food_validation_requests drop column normalized_name;
alter table public.food_validation_requests
  add column normalized_name text generated always as (public.food_key(food_name)) stored,
  add constraint food_validation_requests_unique_name unique (business_id, normalized_name);

create index foods_public_catalog_idx
  on public.foods (business_id, approval_status, normalized_name);

-- Dropping the columns removed their column-level grants.
grant select (normalized_name) on public.foods to anon;
grant select (normalized_alias) on public.food_aliases to anon;
