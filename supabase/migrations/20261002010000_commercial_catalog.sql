create schema if not exists private;

create or replace function public.is_nutriflow_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

create table public.business_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '00000000-0000-0000-0000-000000000001',
  business_name text not null default 'NutriFlow',
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  show_food_prices boolean not null default false,
  packaging_cost_per_meal numeric(12, 4) not null default 0 check (packaging_cost_per_meal >= 0),
  labor_cost_per_meal numeric(12, 4) not null default 0 check (labor_cost_per_meal >= 0),
  overhead_cost_per_meal numeric(12, 4) not null default 0 check (overhead_cost_per_meal >= 0),
  markup_percent numeric(7, 4) not null default 0 check (markup_percent >= 0 and markup_percent < 100),
  app_fee_percent numeric(7, 4) not null default 0 check (app_fee_percent >= 0 and app_fee_percent < 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint business_configs_valid_gross_up check (markup_percent + app_fee_percent < 100)
);

create unique index business_configs_one_active_per_business
  on public.business_configs (business_id)
  where is_active;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '00000000-0000-0000-0000-000000000001',
  canonical_name text not null check (length(btrim(canonical_name)) > 0),
  normalized_name text generated always as (
    lower(regexp_replace(btrim(canonical_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  category text not null default 'out'
    check (category in ('prot', 'arroz', 'feijao', 'tub', 'mac', 'ovo', 'supl', 'out')),
  base_unit text not null default 'g' check (base_unit in ('g', 'ml', 'unit')),
  purchase_unit_label text not null default 'kg' check (length(btrim(purchase_unit_label)) > 0),
  purchase_increment numeric(12, 4) not null default 1000 check (purchase_increment > 0),
  price_per_purchase_unit numeric(12, 4) check (price_per_purchase_unit is null or price_per_purchase_unit >= 0),
  cooking_factor numeric(8, 4) not null default 1 check (cooking_factor > 0),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint foods_name_unique_per_business unique (business_id, normalized_name),
  constraint foods_approved_has_price check (
    approval_status <> 'approved' or price_per_purchase_unit is not null
  )
);

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '00000000-0000-0000-0000-000000000001',
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null check (length(btrim(alias)) > 0),
  normalized_alias text generated always as (
    lower(regexp_replace(btrim(alias), '[[:space:]]+', ' ', 'g'))
  ) stored,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint food_aliases_unique_per_business unique (business_id, normalized_alias)
);

create index food_aliases_food_id_idx on public.food_aliases (food_id);
create index foods_public_catalog_idx
  on public.foods (business_id, approval_status, normalized_name);

create table public.food_price_history (
  id bigint generated always as identity primary key,
  food_id uuid not null references public.foods(id) on delete cascade,
  price_per_purchase_unit numeric(12, 4) not null check (price_per_purchase_unit >= 0),
  purchase_unit_label text not null,
  purchase_increment numeric(12, 4) not null check (purchase_increment > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);

create index food_price_history_food_changed_idx
  on public.food_price_history (food_id, changed_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function private.record_food_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_currency text;
begin
  select currency into config_currency
  from public.business_configs
  where business_id = new.business_id and is_active
  limit 1;

  if new.price_per_purchase_unit is not null then
    insert into public.food_price_history (
      food_id,
      price_per_purchase_unit,
      purchase_unit_label,
      purchase_increment,
      currency,
      changed_by
    ) values (
      new.id,
      new.price_per_purchase_unit,
      new.purchase_unit_label,
      new.purchase_increment,
      coalesce(config_currency, 'BRL'),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger business_configs_touch_updated_at
before update on public.business_configs
for each row execute function private.touch_updated_at();

create trigger foods_touch_updated_at
before update on public.foods
for each row execute function private.touch_updated_at();

create trigger foods_record_initial_price
after insert on public.foods
for each row execute function private.record_food_price();

create trigger foods_record_price_change
after update of price_per_purchase_unit, purchase_unit_label, purchase_increment
on public.foods
for each row
when (
  old.price_per_purchase_unit is distinct from new.price_per_purchase_unit
  or old.purchase_unit_label is distinct from new.purchase_unit_label
  or old.purchase_increment is distinct from new.purchase_increment
)
execute function private.record_food_price();

alter table public.business_configs enable row level security;
alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_price_history enable row level security;

create policy "Public can read the active business configuration"
on public.business_configs for select
to anon, authenticated
using (is_active);

create policy "Admins can manage business configurations"
on public.business_configs for all
to authenticated
using (public.is_nutriflow_admin())
with check (public.is_nutriflow_admin());

create policy "Public can read approved foods"
on public.foods for select
to anon, authenticated
using (approval_status = 'approved');

create policy "Admins can manage foods"
on public.foods for all
to authenticated
using (public.is_nutriflow_admin())
with check (public.is_nutriflow_admin());

create policy "Public can read aliases of approved foods"
on public.food_aliases for select
to anon, authenticated
using (
  exists (
    select 1 from public.foods
    where foods.id = food_aliases.food_id
      and foods.approval_status = 'approved'
  )
);

create policy "Admins can manage food aliases"
on public.food_aliases for all
to authenticated
using (public.is_nutriflow_admin())
with check (public.is_nutriflow_admin());

create policy "Admins can read price history"
on public.food_price_history for select
to authenticated
using (public.is_nutriflow_admin());

revoke all on public.foods, public.food_aliases, public.business_configs,
  public.food_price_history from anon, authenticated;
grant select on public.foods, public.food_aliases, public.business_configs
  to anon, authenticated;
grant insert, update, delete on public.foods, public.food_aliases,
  public.business_configs to authenticated;
grant select on public.food_price_history to authenticated;
grant usage, select on sequence public.food_price_history_id_seq to authenticated;

insert into public.business_configs (business_id, business_name)
values ('00000000-0000-0000-0000-000000000001', 'NutriFlow')
on conflict (business_id) where is_active do nothing;
