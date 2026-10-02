import { aggregateItems, calculatePurchase } from '../utils/pricing-engine.js';
import { sanitizeFoodName } from '../utils/food-matching.js';

export const DEFAULT_COOKING_FACTORS = {
  prot: 0.75, arroz: 2.5, feijao: 2.8, mac: 2.2, tub: 1, ovo: 1, supl: 1, out: 1,
};

const categoryMatchers = [
  ['ovo', /\bovos?\b/i],
  ['supl', /whey|leite em p/i],
  ['arroz', /arroz/i],
  ['feijao', /feij[aã]o|lentilha/i],
  ['mac', /macarr|massa|espaguete/i],
  ['tub', /batata|ab[oó]bora|aipim|mandioca|inhame|cabotia/i],
  ['prot', /frango|carne|patinho|peixe|til[aá]pia|bife|merluza|salm[aã]o|ac[eé]m/i],
];

const categoryFor = name => categoryMatchers.find(([, matcher]) => matcher.test(name))?.[0] ?? 'out';
const normalizeBaseUnit = unit => unit === 'unit' ? 'un' : unit;

function catalogIndex(catalog) {
  const foods = catalog?.foods ?? [];
  const index = new Map();
  for (const food of foods) index.set(sanitizeFoodName(food.canonical_name), food);
  for (const alias of catalog?.aliases ?? []) {
    const food = foods.find(entry => entry.id === alias.food_id);
    if (food) index.set(sanitizeFoodName(alias.alias), food);
  }
  return index;
}

function purchaseUnit(food) {
  const label = String(food.purchase_unit_label).trim().toLocaleLowerCase('pt-BR');
  if (['kg', 'g', 'l', 'ml', 'un', 'und', 'unid', 'unidade', 'unidades', 'unit'].includes(label)) {
    return label === 'und' || label === 'unid' || label === 'unidade' || label === 'unidades' || label === 'unit'
      ? 'un' : label;
  }
  return food.base_unit === 'unit' ? 'un' : food.base_unit;
}

function packageQuantity(food, targetUnit) {
  const increment = Number(food.purchase_increment);
  if (food.base_unit === 'g' && targetUnit === 'kg') return increment / 1000;
  if (food.base_unit === 'ml' && targetUnit === 'l') return increment / 1000;
  return increment;
}

function makeEngineItem(alternative, food) {
  const prescribedUnit = alternative.g ? 'g' : alternative.ml ? 'ml' : 'un';
  const quantity = alternative.g || alternative.ml || alternative.n;
  const purchaseUnitName = purchaseUnit(food);
  return {
    foodId: food.id,
    name: food.canonical_name,
    prescribedQuantity: quantity,
    prescribedUnit,
    cooking: { factor: Number(food.cooking_factor) || DEFAULT_COOKING_FACTORS[food.category] || 1 },
    pricing: {
      unit: purchaseUnitName,
      price: food.price_per_purchase_unit == null ? 0 : Number(food.price_per_purchase_unit),
      estimated: false,
      source: 'catalog',
    },
    purchase: {
      packageQuantity: packageQuantity(food, purchaseUnitName),
      packageUnit: purchaseUnitName,
    },
    servings: 1,
    mealQuantity: 0,
    category: food.category,
  };
}

function chooseByActualPurchaseCost(alternatives, state, day, days, lookup) {
  if (state.mode !== 'eco') {
    return alternatives[Math.min(alternatives.length - 1, Math.floor(day / Math.ceil(days / alternatives.length)))];
  }
  const candidates = alternatives.map(alternative => {
    const food = lookup.get(sanitizeFoodName(alternative.name));
    if (!food || food.price_per_purchase_unit == null
      || normalizeBaseUnit(food.base_unit) !== (alternative.ml ? 'ml' : alternative.g ? 'g' : 'un')) {
      return { alternative, cost: null };
    }
    const item = makeEngineItem(alternative, food);
    const estimatedCycleItem = { ...item, prescribedQuantity: item.prescribedQuantity * days };
    return { alternative, cost: calculatePurchase(estimatedCycleItem).purchaseCost };
  });
  return candidates.reduce((best, candidate) =>
    candidate.cost != null && (best.cost == null || candidate.cost < best.cost) ? candidate : best
  ).alternative;
}

function validateConfig(config, days) {
  if (!config) return 'Parâmetros comerciais ainda não foram sincronizados.';
  const percentages = [Number(config.markup_percent), Number(config.app_fee_percent)];
  const costs = [
    Number(config.packaging_cost_per_meal),
    Number(config.labor_cost_per_meal),
    Number(config.overhead_cost_per_meal),
  ];
  if (percentages.some(value => !Number.isFinite(value) || value < 0) || percentages[0] + percentages[1] >= 100) {
    return 'A soma do markup e da taxa do app deve ser inferior a 100%.';
  }
  if (costs.some(value => !Number.isFinite(value) || value < 0)) {
    return 'A configuração comercial contém um custo inválido.';
  }
  if (!Number.isInteger(days) || days < 1) return 'O ciclo precisa ter pelo menos um dia.';
  return null;
}

export function calculateCommercialQuote(meals, state, catalog, now = new Date()) {
  const lookup = catalogIndex(catalog);
  const requirements = new Map();
  const menu = [];
  const pendingFoods = new Map();
  const pricedSelections = [];
  let marmitaCount = 0;

  for (const [mealIndex, meal] of meals.entries()) {
    if (state.moff[mealIndex]) continue;
    const isMarmita = /almo|jantar/i.test(meal.name);
    const activeOptions = meal.opts
      .map((option, optionIndex) => ({ option, optionIndex }))
      .filter(({ optionIndex }) => !state.off[`${mealIndex}.${optionIndex}`]);
    if (!activeOptions.length) continue;
    if (isMarmita) marmitaCount += state.days;

    const dailySelections = new Map();
    for (let day = 0; day < state.days; day += 1) {
      const { option, optionIndex } = activeOptions[day % activeOptions.length];
      const chosenNames = [];
      for (const [componentIndex, component] of option.comps.entries()) {
        const alternatives = component.alts.filter((_, alternativeIndex) =>
          !state.off[`${mealIndex}.${optionIndex}.${componentIndex}.${alternativeIndex}`]);
        if (!alternatives.length) continue;
        const selected = chooseByActualPurchaseCost(alternatives, state, day, state.days, lookup);
        const food = lookup.get(sanitizeFoodName(selected.name)) ?? null;
        const baseUnit = selected.ml ? 'ml' : selected.g ? 'g' : 'unit';
        const prescribedAmount = selected.ml || selected.g || selected.n;
        const unitMismatch = Boolean(food && normalizeBaseUnit(food.base_unit) !== normalizeBaseUnit(baseUnit));
        const foodKey = food?.id ?? `pending:${sanitizeFoodName(selected.name)}`;
        const key = `${foodKey}|${normalizeBaseUnit(baseUnit)}`;
        let line = requirements.get(key);
        if (!line) {
          line = {
            foodId: food?.id ?? null,
            name: food?.canonical_name ?? selected.name,
            category: food?.category ?? selected.cat ?? selected.category ?? categoryFor(selected.name),
            baseUnit: unitMismatch ? baseUnit : food?.base_unit ?? baseUnit,
            prescribedAmount: 0,
            rawAmount: 0,
            purchaseAmount: null,
            packages: null,
            unitPrice: food?.price_per_purchase_unit == null ? null : Number(food.price_per_purchase_unit),
            unitLabel: food?.purchase_unit_label ?? (baseUnit === 'g' ? 'g' : baseUnit === 'ml' ? 'ml' : 'un'),
            cost: null,
            purchaseCost: null,
            pending: !catalog?.unavailable && (!food || unitMismatch || (food.price_per_purchase_unit == null && !catalog?.pricesProtected)),
            pricingUnavailable: Boolean(catalog?.unavailable || (food && food.price_per_purchase_unit == null && catalog?.pricesProtected)),
            catalogUnavailable: Boolean(catalog?.unavailable),
            unitMismatch,
            showUnitPrice: catalog?.config?.show_food_prices ?? false,
          };
        }
        line.prescribedAmount += prescribedAmount;
        const factor = unitMismatch ? 1 : Number(food?.cooking_factor) || DEFAULT_COOKING_FACTORS[line.category] || 1;
        line.rawAmount += selected.g || selected.ml ? prescribedAmount / factor : prescribedAmount;
        line.unitMismatch ||= unitMismatch;
        line.pending ||= !catalog?.unavailable && (!food || unitMismatch || (food.price_per_purchase_unit == null && !catalog?.pricesProtected));
        line.pricingUnavailable ||= Boolean(catalog?.unavailable || (food && food.price_per_purchase_unit == null && catalog?.pricesProtected));
        line.catalogUnavailable ||= Boolean(catalog?.unavailable);
        requirements.set(key, line);
        if (food && !unitMismatch && (food.price_per_purchase_unit != null || catalog?.pricesProtected)) {
          pricedSelections.push(makeEngineItem(selected, food));
        }
        chosenNames.push(selected.name);
      }
      const key = `${option.name ? `${option.name}: ` : ''}${chosenNames.join(' + ')}`;
      dailySelections.set(key, (dailySelections.get(key) ?? 0) + 1);
    }
    menu.push({ name: meal.name, time: meal.time, isMarmita, selections: [...dailySelections] });
  }

  const calculated = new Map(
    aggregateItems(pricedSelections).map(line => [`${line.foodId}|${normalizeBaseUnit(line.prescribedUnit)}`, line]),
  );
  for (const line of requirements.values()) {
    if (line.pending) {
      pendingFoods.set(`${line.foodId ?? `pending:${sanitizeFoodName(line.name)}`}|${normalizeBaseUnit(line.baseUnit)}`, line);
      continue;
    }
    if (line.pricingUnavailable && line.catalogUnavailable) continue;
    const amount = calculated.get(`${line.foodId}|${normalizeBaseUnit(line.baseUnit)}`);
    if (!amount) {
      line.pending = true;
      pendingFoods.set(`${line.foodId}|${normalizeBaseUnit(line.baseUnit)}`, line);
      continue;
    }
    line.rawAmount = amount.rawQuantity;
    line.purchaseAmount = amount.purchaseQuantity;
    line.packages = amount.packages;
    line.cost = line.pricingUnavailable ? null : amount.consumedCost;
    line.purchaseCost = line.pricingUnavailable ? null : amount.purchaseCost;
  }

  const lines = [...requirements.values()];
  const knownFoodCost = lines.reduce((total, line) => total + (line.cost ?? 0), 0);
  const totalPurchaseCost = lines.reduce((total, line) => total + (line.purchaseCost ?? 0), 0);
  const config = catalog?.config ?? null;
  const configError = validateConfig(config, state.days);
  const hasPending = lines.some(line => line.pending || line.pricingUnavailable);
  const productionCost = (
    Number(config?.packaging_cost_per_meal ?? 0)
    + Number(config?.labor_cost_per_meal ?? 0)
    + Number(config?.overhead_cost_per_meal ?? 0)
  ) * marmitaCount;
  const rate = (Number(config?.markup_percent ?? 0) + Number(config?.app_fee_percent ?? 0)) / 100;
  const noPortions = marmitaCount === 0;
  const finalPrice = !configError && !hasPending && !noPortions
    ? (knownFoodCost + productionCost) / (1 - rate)
    : null;
  const markupAmount = finalPrice == null ? null : finalPrice * Number(config?.markup_percent ?? 0) / 100;
  const appFeeAmount = finalPrice == null ? null : finalPrice * Number(config?.app_fee_percent ?? 0) / 100;

  return {
    meals: menu,
    lines,
    pendingFoods: [...pendingFoods.values()],
    pricingUnavailable: lines.some(line => line.pricingUnavailable),
    catalogUnavailable: Boolean(catalog?.unavailable),
    marmitaCount,
    foodCost: hasPending ? null : knownFoodCost,
    knownFoodCost,
    totalPurchaseCost,
    productionCost,
    markupAmount,
    appFeeAmount,
    finalPrice,
    unitPrice: finalPrice != null && marmitaCount > 0 ? finalPrice / marmitaCount : null,
    status: configError ? 'configuration-error' : noPortions ? 'no-portions' : hasPending ? 'provisional' : 'ready',
    configError: configError ?? (noPortions ? 'Selecione almoço ou jantar para gerar um orçamento de marmitas.' : null),
    currency: config?.currency ?? 'BRL',
    syncedAt: catalog?.syncedAt ?? null,
    generatedAt: now.toISOString(),
    offline: typeof navigator !== 'undefined' && !navigator.onLine,
    configSnapshot: config ? structuredClone(config) : null,
  };
}

export function formatQuantity(value, unit) {
  const amount = Number(value) || 0;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(amount)} ${unit}`;
}

export function createQuoteSnapshot(quote, state, customerName = '') {
  return structuredClone({
    id: crypto.randomUUID(),
    requestKey: JSON.stringify({
      text: state.text,
      days: state.days,
      mode: state.mode,
      off: state.off,
      moff: state.moff,
    }),
    customerName: customerName.trim(),
    createdAt: quote.generatedAt,
    days: state.days,
    mode: state.mode,
    selectedMeals: quote.meals,
    marmitaCount: quote.marmitaCount,
    lines: quote.lines,
    foodCost: quote.foodCost,
    knownFoodCost: quote.knownFoodCost,
    totalPurchaseCost: quote.totalPurchaseCost,
    productionCost: quote.productionCost,
    markupAmount: quote.markupAmount,
    appFeeAmount: quote.appFeeAmount,
    finalPrice: quote.finalPrice,
    unitPrice: quote.unitPrice,
    status: quote.status,
    configError: quote.configError,
    pricingUnavailable: quote.pricingUnavailable,
    pendingFoods: quote.pendingFoods,
    configSnapshot: quote.configSnapshot,
    syncedAt: quote.syncedAt,
    offline: quote.offline,
  });
}

export function formatWhatsAppQuote(snapshot) {
  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: snapshot.configSnapshot?.currency ?? 'BRL',
  });
  const lines = [
    `Orçamento NutriFlow${snapshot.customerName ? ` — ${snapshot.customerName}` : ''}`,
    `Ciclo: ${snapshot.days} dias / ${snapshot.marmitaCount} marmitas`,
    '',
    'Refeições e escolhas:',
    ...snapshot.selectedMeals.flatMap(meal => [
      `${meal.name}${meal.time ? ` (${meal.time})` : ''}${meal.isMarmita ? ' — marmitas' : ''}`,
      ...meal.selections.map(([selection, count]) => `  • ${count} dia(s): ${selection}`),
    ]),
    '',
    `Custo dos alimentos: ${snapshot.pricingUnavailable ? 'indisponível sem conexão com o servidor' : snapshot.foodCost == null ? `provisório (${money.format(snapshot.knownFoodCost)} conhecido)` : money.format(snapshot.foodCost)}`,
    `Custo de confecção: ${snapshot.configError ? 'a confirmar após sincronizar' : money.format(snapshot.productionCost)}`,
    `Markup: ${snapshot.markupAmount == null ? 'sujeito à confirmação' : money.format(snapshot.markupAmount)}`,
    `Taxa do app: ${snapshot.appFeeAmount == null ? 'sujeita à confirmação' : money.format(snapshot.appFeeAmount)}`,
    `Total estimado: ${snapshot.finalPrice == null ? 'Provisório / sujeito à confirmação' : money.format(snapshot.finalPrice)}`,
    `Por marmita: ${snapshot.unitPrice == null ? 'sujeito à confirmação' : money.format(snapshot.unitPrice)}`,
    ...(snapshot.pendingFoods.length
      ? ['', 'Pendentes de validação do admin:', ...snapshot.pendingFoods.map(food => `  • ${food.name}: ${food.rawAmount} ${food.baseUnit}`)]
      : []),
    '',
    snapshot.offline && snapshot.syncedAt
      ? `Orçamento gerado offline — catálogo sincronizado em ${new Date(snapshot.syncedAt).toLocaleString('pt-BR')}; sujeito à confirmação.`
      : snapshot.offline
        ? 'Orçamento gerado offline sem catálogo sincronizado — sujeito à confirmação.'
        : 'Preços sujeitos à disponibilidade no momento da confirmação.',
    'Entrega: A combinar.',
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}
