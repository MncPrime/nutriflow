/**
 * NutriFlow Pricing Engine v2
 * Pure pricing domain logic. No DOM, localStorage or framework dependencies.
 */

export const UNIT_ALIASES = {
  kg: 'kg', g: 'g', gram: 'g', gramas: 'g',
  ml: 'ml', l: 'l', litro: 'l', litros: 'l',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', unit: 'un',
};

export function normalizeUnit(unit = 'g') {
  const key = String(unit).trim().toLowerCase();
  return UNIT_ALIASES[key] || key;
}

export function normalizeQuantity(quantity, unit) {
  const q = Number(quantity) || 0;
  const u = normalizeUnit(unit);
  if (u === 'kg') return { quantity: q * 1000, unit: 'g' };
  if (u === 'l') return { quantity: q * 1000, unit: 'ml' };
  return { quantity: q, unit: u };
}

export function priceKey(foodId, unit) {
  return `${foodId}|${normalizeUnit(unit)}`;
}

export function ceilPackages(quantity, packageQuantity) {
  if (quantity <= 0) return 0;
  if (!(packageQuantity > 0)) return quantity;
  return Math.ceil((quantity - 1e-9) / packageQuantity);
}

const hasPrice = value =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

export function resolvePrice(pricing, overrides = {}) {
  const unit = normalizeUnit(pricing.unit);
  const key = priceKey(pricing.foodId, unit);
  const override = overrides[key];
  if (hasPrice(override)) {
    return { value: Number(override), source: 'user', estimated: false, unit };
  }
  if (hasPrice(pricing.price)) {
    return {
      value: Number(pricing.price),
      source: pricing.source || 'catalog',
      estimated: pricing.estimated !== false,
      unit,
    };
  }
  return { value: 0, source: 'missing', estimated: true, unit };
}

/**
 * Convert prescribed quantity into raw purchase quantity.
 * factor is the cooked/raw yield, e.g. 2.5 means 100g cooked needs 40g raw.
 */
export function toRawQuantity(item) {
  const unit = normalizeUnit(item.prescribedUnit);
  const quantity = Number(item.prescribedQuantity) || 0;
  if (unit !== 'g') return { quantity, unit };
  const factor = Number(item.cooking?.factor) > 0 ? Number(item.cooking.factor) : 1;
  return { quantity: quantity / factor, unit: 'g' };
}

export function calculatePurchase(item, overrides = {}) {
  const raw = toRawQuantity(item);
  const pricing = { ...item.pricing, foodId: item.foodId };
  const resolved = resolvePrice(pricing, overrides);
  const purchaseUnit = normalizeUnit(pricing.unit || raw.unit);

  if (purchaseUnit === 'un') {
    const unitWeight = Number(item.purchase?.unitWeight);
    const required = raw.unit === 'g' && unitWeight > 0
      ? raw.quantity / unitWeight
      : raw.quantity;
    const packageQty = Number(item.purchase?.packageQuantity) || 1;
    const packages = ceilPackages(required, packageQty);
    const purchaseQuantity = packages * packageQty;
    return {
      requiredQuantity: required,
      requiredUnit: 'un',
      purchaseQuantity,
      purchaseUnit: 'un',
      packageQuantity: packageQty,
      packages,
      consumedCost: required * resolved.value,
      purchaseCost: purchaseQuantity * resolved.value,
      excessCost: Math.max(0, purchaseQuantity - required) * resolved.value,
      price: resolved,
    };
  }

  let required = raw.quantity;
  let requiredUnit = raw.unit;
  if (purchaseUnit === 'kg' && raw.unit === 'g') {
    required = raw.quantity / 1000;
    requiredUnit = 'kg';
  } else if (purchaseUnit === 'g' && raw.unit === 'kg') {
    required = raw.quantity * 1000;
    requiredUnit = 'g';
  } else if (purchaseUnit === 'l' && raw.unit === 'ml') {
    required = raw.quantity / 1000;
    requiredUnit = 'l';
  } else if (purchaseUnit === 'ml' && raw.unit === 'l') {
    required = raw.quantity * 1000;
    requiredUnit = 'ml';
  } else if (purchaseUnit !== raw.unit) {
    throw new Error(`Unidade incompatível: ${raw.unit} → ${purchaseUnit}`);
  }

  let packageQty = Number(item.purchase?.packageQuantity) || 0;
  const packageUnit = normalizeUnit(item.purchase?.packageUnit || purchaseUnit);
  if (purchaseUnit === 'kg' && packageUnit === 'g') packageQty /= 1000;
  if (purchaseUnit === 'g' && packageUnit === 'kg') packageQty *= 1000;
  if (purchaseUnit === 'l' && packageUnit === 'ml') packageQty /= 1000;
  if (purchaseUnit === 'ml' && packageUnit === 'l') packageQty *= 1000;
  const packages = packageQty > 0 ? ceilPackages(required, packageQty) : 0;
  const purchaseQuantity = packageQty > 0 ? packages * packageQty : required;

  return {
    requiredQuantity: required,
    requiredUnit,
    purchaseQuantity,
    purchaseUnit,
    packageQuantity: packageQty,
    packages,
    consumedCost: required * resolved.value,
    purchaseCost: purchaseQuantity * resolved.value,
    excessCost: Math.max(0, purchaseQuantity - required) * resolved.value,
    price: resolved,
  };
}

export function calculateAlternativeCost(item, overrides = {}) {
  return calculatePurchase(item, overrides).purchaseCost;
}

export function chooseAlternative(alternatives, mode = 'var', overrides = {}) {
  if (!alternatives.length) return null;
  if (mode !== 'eco') return alternatives[0];
  return alternatives.reduce((best, candidate) =>
    calculateAlternativeCost(candidate, overrides) < calculateAlternativeCost(best, overrides)
      ? candidate : best
  );
}

export function aggregateItems(items, overrides = {}) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.foodId}|${normalizeUnit(item.prescribedUnit)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...item, prescribedQuantity: 0, servings: 0, mealQuantity: 0,
      });
    }
    const target = map.get(key);
    target.prescribedQuantity += Number(item.prescribedQuantity) || 0;
    target.servings += Number(item.servings) || 0;
    target.mealQuantity += Number(item.mealQuantity) || 0;
  }

  return [...map.values()].map(item => {
    const raw = toRawQuantity(item);
    const calc = calculatePurchase(item, overrides);
    return {
      ...item,
      requiredQuantity: calc.requiredQuantity,
      rawQuantity: raw.quantity,
      purchaseQuantity: calc.purchaseQuantity,
      packages: calc.packages,
      consumedCost: calc.consumedCost,
      purchaseCost: calc.purchaseCost,
      excessCost: calc.excessCost,
      price: calc.price,
    };
  });
}

export function calculateCycle({ days, selections, overrides = {} }) {
  const selected = [];
  for (let day = 0; day < days; day += 1) {
    for (const selection of selections) {
      const item = selection(day);
      if (item) selected.push({ ...item, servings: 1 });
    }
  }
  const lines = aggregateItems(selected, overrides);
  const purchaseCost = lines.reduce((sum, item) => sum + item.purchaseCost, 0);
  const consumedCost = lines.reduce((sum, item) => sum + item.consumedCost, 0);
  const excessCost = lines.reduce((sum, item) => sum + item.excessCost, 0);
  return {
    days,
    lines,
    totals: {
      purchaseCost,
      consumedCost,
      excessCost,
      wasteRate: purchaseCost ? excessCost / purchaseCost : 0,
    },
  };
}
