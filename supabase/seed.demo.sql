begin;

alter table public.business_configs
  add column if not exists is_demo_data boolean not null default false;

update public.business_configs
set business_name = 'NutriFlow DEMONSTRACAO - valores ilustrativos',
    show_food_prices = true,
    is_demo_data = true,
    packaging_cost_per_meal = 2.50,
    labor_cost_per_meal = 5.00,
    overhead_cost_per_meal = 1.50,
    markup_percent = 30,
    app_fee_percent = 5
where business_id = '00000000-0000-0000-0000-000000000001'
  and is_active;

insert into public.foods (
  business_id, canonical_name, category, base_unit, purchase_unit_label,
  purchase_increment, price_per_purchase_unit, cooking_factor, approval_status
) values
  ('00000000-0000-0000-0000-000000000001', 'banana', 'out', 'unit', 'unidade', 1, 1.20, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'mamão papaia', 'out', 'g', 'kg', 1000, 8.50, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'farelo de aveia', 'out', 'g', 'kg', 1000, 18.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'pão de forma integral', 'out', 'unit', 'fatia', 1, 0.95, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'pão francês', 'out', 'unit', 'unidade', 1, 0.90, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'pão de forma', 'out', 'unit', 'fatia', 1, 0.95, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'queijo minas frescal', 'out', 'g', 'kg', 1000, 34.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'queijo minas', 'out', 'g', 'kg', 1000, 32.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'mussarela', 'out', 'g', 'kg', 1000, 38.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'ovo mexido', 'ovo', 'unit', 'unidade', 1, 1.50, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'açúcar', 'out', 'g', 'kg', 1000, 5.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'iogurte (cenoura, mel e laranja)', 'out', 'g', 'kg', 1000, 16.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'granola', 'out', 'g', 'kg', 1000, 26.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'mel', 'out', 'g', 'kg', 1000, 45.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'whey protein concentrado', 'supl', 'g', 'kg', 1000, 120.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'leite em pó', 'supl', 'g', 'kg', 1000, 32.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'maçã', 'out', 'g', 'kg', 1000, 12.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'pera', 'out', 'g', 'kg', 1000, 14.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'manga', 'out', 'g', 'kg', 1000, 10.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'arroz integral cozido', 'arroz', 'g', 'kg', 1000, 8.00, 2.5, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'arroz branco cozido', 'arroz', 'g', 'kg', 1000, 6.00, 2.5, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'aipim cozido', 'tub', 'g', 'kg', 1000, 8.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'inhame cozido', 'tub', 'g', 'kg', 1000, 9.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'batata inglesa cozida', 'tub', 'g', 'kg', 1000, 7.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'abóbora cabotiã cozida', 'tub', 'g', 'kg', 1000, 6.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'macarrão cozido', 'mac', 'g', 'kg', 1000, 10.00, 2.2, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'feijão cozido', 'feijao', 'g', 'kg', 1000, 10.00, 2.8, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'filé de frango grelhado', 'prot', 'g', 'kg', 1000, 28.00, 0.75, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'carne patinho moída', 'prot', 'g', 'kg', 1000, 55.00, 0.75, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'ovo cozido', 'ovo', 'unit', 'unidade', 1, 1.50, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'peixe grelhado', 'prot', 'g', 'kg', 1000, 45.00, 0.75, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'cenoura', 'out', 'g', 'kg', 1000, 6.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'beterraba', 'out', 'g', 'kg', 1000, 7.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'vagem', 'out', 'g', 'kg', 1000, 12.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'brócolis', 'out', 'g', 'kg', 1000, 15.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'couve-flor', 'out', 'g', 'kg', 1000, 14.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'chuchu', 'out', 'g', 'kg', 1000, 5.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'abobrinha', 'out', 'g', 'kg', 1000, 7.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'tomate', 'out', 'g', 'kg', 1000, 10.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'pepino', 'out', 'g', 'kg', 1000, 6.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'tangerina', 'out', 'unit', 'unidade', 1, 1.20, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'laranja', 'out', 'unit', 'unidade', 1, 1.50, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'limão', 'out', 'unit', 'unidade', 1, 1.00, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'kiwi', 'out', 'unit', 'unidade', 1, 2.50, 1, 'approved'),
  ('00000000-0000-0000-0000-000000000001', 'abacaxi', 'out', 'g', 'kg', 1000, 8.00, 1, 'approved')
on conflict (business_id, normalized_name) do update
set category = excluded.category,
    base_unit = excluded.base_unit,
    purchase_unit_label = excluded.purchase_unit_label,
    purchase_increment = excluded.purchase_increment,
    price_per_purchase_unit = excluded.price_per_purchase_unit,
    cooking_factor = excluded.cooking_factor,
    approval_status = excluded.approval_status;

commit;
