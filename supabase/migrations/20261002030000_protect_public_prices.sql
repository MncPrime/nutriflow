drop policy if exists "Public can read the active business configuration"
  on public.business_configs;
drop policy if exists "Public can read approved foods"
  on public.foods;
drop policy if exists "Public can read aliases of approved foods"
  on public.food_aliases;

create policy "Anonymous users can read approved foods"
on public.foods for select
to anon
using (approval_status = 'approved');

create policy "Anonymous users can read aliases of approved foods"
on public.food_aliases for select
to anon
using (
  exists (
    select 1 from public.foods
    where foods.id = food_aliases.food_id
      and foods.approval_status = 'approved'
  )
);

revoke all on public.business_configs from anon, authenticated;
revoke all on public.foods from anon, authenticated;
revoke all on public.food_aliases from anon, authenticated;

grant select (
  id, business_id, canonical_name, normalized_name, category, base_unit,
  purchase_unit_label, purchase_increment, cooking_factor, approval_status,
  created_at, updated_at
) on public.foods to anon;
grant select (
  id, business_id, food_id, alias, normalized_alias, created_at
) on public.food_aliases to anon;

grant select, insert, update, delete
  on public.business_configs, public.foods, public.food_aliases
  to authenticated;

create table public.food_validation_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '00000000-0000-0000-0000-000000000001',
  food_name text not null check (length(btrim(food_name)) > 0 and length(food_name) <= 200),
  normalized_name text generated always as (
    lower(regexp_replace(btrim(food_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  category text not null default 'out'
    check (category in ('prot', 'arroz', 'feijao', 'tub', 'mac', 'ovo', 'supl', 'out')),
  base_unit text not null check (base_unit in ('g', 'ml', 'unit')),
  requested_quantity numeric(12, 4) not null check (requested_quantity > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  resolved_food_id uuid references public.foods(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint food_validation_requests_unique_name unique (business_id, normalized_name)
);

alter table public.food_validation_requests enable row level security;

create policy "Anonymous users can submit food validation requests"
on public.food_validation_requests for insert
to anon
with check (
  status = 'pending'
  and business_id = '00000000-0000-0000-0000-000000000001'
);

create policy "Admins can review food validation requests"
on public.food_validation_requests for select
to authenticated
using (public.is_nutriflow_admin());

create policy "Admins can resolve food validation requests"
on public.food_validation_requests for update
to authenticated
using (public.is_nutriflow_admin())
with check (public.is_nutriflow_admin());

create policy "Admins can create food validation requests"
on public.food_validation_requests for insert
to authenticated
with check (public.is_nutriflow_admin());

revoke all on public.food_validation_requests from anon, authenticated;
grant insert (business_id, food_name, category, base_unit, requested_quantity)
  on public.food_validation_requests to anon;
grant select, insert, update on public.food_validation_requests to authenticated;
