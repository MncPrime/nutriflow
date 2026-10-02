alter table public.business_configs
  add column if not exists is_demo_data boolean not null default false;
