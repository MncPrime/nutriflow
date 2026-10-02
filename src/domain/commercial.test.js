import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommercialQuote, createQuoteSnapshot, formatWhatsAppQuote } from './commercial.js';

const config = {
  currency: 'BRL',
  show_food_prices: false,
  packaging_cost_per_meal: 1,
  labor_cost_per_meal: 1,
  overhead_cost_per_meal: 1,
  markup_percent: 30,
  app_fee_percent: 5,
};

const foods = [
  {
    id: 'rice', canonical_name: 'arroz integral cozido', category: 'arroz',
    base_unit: 'g', purchase_unit_label: 'kg', purchase_increment: 1000,
    price_per_purchase_unit: 8, cooking_factor: 2.5,
  },
  {
    id: 'chicken', canonical_name: 'filé de frango grelhado', category: 'prot',
    base_unit: 'g', purchase_unit_label: 'kg', purchase_increment: 1000,
    price_per_purchase_unit: 28, cooking_factor: 0.75,
  },
  {
    id: 'milk', canonical_name: 'leite', category: 'out',
    base_unit: 'ml', purchase_unit_label: 'l', purchase_increment: 1000,
    price_per_purchase_unit: 5, cooking_factor: 1,
  },
];

const mealPlan = [{
  name: 'Almoço',
  time: '12:00',
  opts: [{
    name: '',
    comps: [
      { alts: [{ name: 'arroz integral cozido', g: 90, n: 0, cat: 'arroz' }] },
      { alts: [{ name: 'filé de frango grelhado', g: 150, n: 0, cat: 'prot' }] },
    ],
  }],
}];

test('commercial quote applies cooking yield, package rounding and business fees', () => {
  const quote = calculateCommercialQuote(
    mealPlan,
    { days: 7, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );

  assert.equal(quote.status, 'ready');
  assert.equal(quote.marmitaCount, 7);
  assert.ok(Math.abs(quote.knownFoodCost - 41.216) < 1e-9);
  assert.equal(quote.totalPurchaseCost, 64);
  assert.equal(quote.productionCost, 21);
  assert.ok(Math.abs(quote.finalPrice - ((41.216 + 21) / 0.65)) < 1e-9);
  assert.ok(Math.abs(quote.markupAmount - quote.finalPrice * 0.3) < 1e-9);
  assert.ok(Math.abs(quote.appFeeAmount - quote.finalPrice * 0.05) < 1e-9);
  assert.equal(quote.lines.every(line => line.showUnitPrice === false), true);
});

test('protected offline catalog keeps quantities but never fabricates a new quote', () => {
  const quote = calculateCommercialQuote(
    mealPlan,
    { days: 7, mode: 'var', off: {}, moff: {} },
    {
      pricesProtected: true,
      foods: foods.map(({ price_per_purchase_unit, ...food }) => food),
      aliases: [],
      config: null,
    },
  );

  assert.equal(quote.status, 'configuration-error');
  assert.equal(quote.finalPrice, null);
  assert.equal(quote.pricingUnavailable, true);
  assert.equal(quote.pendingFoods.length, 0);
  assert.equal(quote.lines.every(line => line.purchaseAmount != null && line.cost == null), true);
});

test('offline without a synchronized catalog does not misclassify every food as pending', () => {
  const quote = calculateCommercialQuote(
    mealPlan,
    { days: 7, mode: 'var', off: {}, moff: {} },
    { foods: [], aliases: [], config: null, pricesProtected: true, unavailable: true },
  );

  assert.equal(quote.status, 'configuration-error');
  assert.equal(quote.pendingFoods.length, 0);
  assert.equal(quote.pricingUnavailable, true);
  assert.equal(quote.lines.every(line => line.purchaseAmount == null && line.pending === false), true);
});

test('catalog aliases resolve foods and a disabled per-food price display remains off', () => {
  const quote = calculateCommercialQuote(
    [{ ...mealPlan[0], opts: [{ ...mealPlan[0].opts[0], comps: [{ alts: [{ name: 'frango', g: 100, n: 0, cat: 'prot' }] }] }] }],
    { days: 1, mode: 'var', off: {}, moff: {} },
    {
      foods,
      aliases: [{ food_id: 'chicken', alias: 'frango' }],
      config: { ...config, show_food_prices: false },
    },
  );

  assert.equal(quote.lines[0].foodId, 'chicken');
  assert.equal(quote.lines[0].showUnitPrice, false);
});

test('shared quote hides internal cost breakdown while preserving the customer price', () => {
  const quote = calculateCommercialQuote(
    mealPlan,
    { days: 7, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );
  const snapshot = createQuoteSnapshot(quote, { days: 7, mode: 'var' }, 'Cliente');
  const link = formatWhatsAppQuote(snapshot);
  const message = decodeURIComponent(link.split('?text=')[1]);

  assert.doesNotMatch(message, /Custo dos alimentos:|Custo de confecção:|Markup:|Taxa do app:/);
  assert.match(message, /Entrega: A combinar/);
  assert.match(message, /Total estimado:/);
});

test('shared quote shows the cost breakdown when the admin enables food prices', () => {
  const quote = calculateCommercialQuote(
    mealPlan,
    { days: 7, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config: { ...config, show_food_prices: true } },
  );
  const snapshot = createQuoteSnapshot(quote, { days: 7, mode: 'var' }, 'Cliente');
  const message = decodeURIComponent(formatWhatsAppQuote(snapshot).split('?text=')[1]);

  assert.match(message, /Custo dos alimentos:/);
  assert.match(message, /Markup:/);
  assert.match(message, /Taxa do app:/);
  assert.match(message, /Total estimado:/);
});

test('unknown foods and incompatible units make the quote provisional', () => {
  const unknown = calculateCommercialQuote(
    [{ ...mealPlan[0], opts: [{ ...mealPlan[0].opts[0], comps: [{ alts: [{ name: 'comida nova', g: 80, n: 0, cat: 'out' }] }] }] }],
    { days: 1, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );
  assert.equal(unknown.status, 'provisional');
  assert.equal(unknown.pendingFoods[0].name, 'comida nova');

  const mismatch = calculateCommercialQuote(
    [{ ...mealPlan[0], opts: [{ ...mealPlan[0].opts[0], comps: [{ alts: [{ name: 'leite', g: 100, n: 0, cat: 'out' }] }] }] }],
    { days: 1, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );
  assert.equal(mismatch.status, 'provisional');
  assert.equal(mismatch.lines[0].unitMismatch, true);
});

test('the same catalog food in incompatible plan units remains separated and provisional', () => {
  const quote = calculateCommercialQuote(
    [{ ...mealPlan[0], opts: [{ ...mealPlan[0].opts[0], comps: [
      { alts: [{ name: 'leite', ml: 250, g: 0, n: 0, cat: 'out' }] },
      { alts: [{ name: 'leite', ml: 0, g: 100, n: 0, cat: 'out' }] },
    ] }] }],
    { days: 1, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );

  assert.equal(quote.status, 'provisional');
  assert.equal(quote.lines.length, 2);
  assert.equal(quote.lines.some(line => line.unitMismatch && line.baseUnit === 'g'), true);
  assert.equal(quote.lines.some(line => !line.unitMismatch && line.baseUnit === 'ml'), true);
});

test('liquid purchases keep milliliters and liters distinct without density conversion', () => {
  const quote = calculateCommercialQuote(
    [{ ...mealPlan[0], opts: [{ ...mealPlan[0].opts[0], comps: [{ alts: [{ name: 'leite', ml: 250, g: 0, n: 0, cat: 'out' }] }] }] }],
    { days: 4, mode: 'var', off: {}, moff: {} },
    { foods, aliases: [], config },
  );
  assert.equal(quote.status, 'ready');
  assert.equal(quote.lines[0].rawAmount, 1000);
  assert.equal(quote.lines[0].purchaseAmount, 1);
  assert.equal(quote.lines[0].unitMismatch, false);
});
