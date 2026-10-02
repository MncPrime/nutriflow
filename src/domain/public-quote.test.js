import test from 'node:test';
import assert from 'node:assert/strict';
import { toPublicQuote } from './public-quote.js';

const quote = {
  meals: [],
  lines: [{
    foodId: 'private-food-id',
    name: 'arroz',
    category: 'arroz',
    baseUnit: 'g',
    prescribedAmount: 100,
    rawAmount: 40,
    purchaseAmount: 1000,
    packages: 1,
    unitLabel: 'kg',
    unitPrice: 8,
    purchaseCost: 8,
    pending: false,
    unitMismatch: false,
  }],
  pendingFoods: [],
  marmitaCount: 1,
  foodCost: 0.32,
  knownFoodCost: 0.32,
  productionCost: 2,
  markupAmount: 1,
  appFeeAmount: 0.2,
  finalPrice: 3.52,
  unitPrice: 3.52,
  status: 'ready',
  currency: 'BRL',
  syncedAt: null,
  generatedAt: '2026-10-02T00:00:00.000Z',
  configSnapshot: { currency: 'BRL', show_food_prices: false, markup_percent: 30 },
};

test('public quote omits ingredient prices, cost breakdown, ids, and internal configuration by default', () => {
  const result = toPublicQuote(quote);
  const serialized = JSON.stringify(result);

  assert.equal(result.lines[0].unitPrice, undefined);
  assert.equal(result.lines[0].purchaseCost, undefined);
  assert.equal(result.lines[0].foodId, undefined);
  for (const field of ['foodCost', 'knownFoodCost', 'productionCost', 'markupAmount', 'appFeeAmount']) {
    assert.equal(result[field], undefined);
  }
  assert.equal(result.finalPrice, 3.52);
  assert.equal(result.unitPrice, 3.52);
  assert.equal(result.configSnapshot.markup_percent, undefined);
  assert.doesNotMatch(serialized, /private-food-id/);
  assert.doesNotMatch(serialized, /0\.32|0\.2/);
});

test('public quote includes ingredient prices and cost breakdown only when the admin enables them', () => {
  const result = toPublicQuote({
    ...quote,
    configSnapshot: { currency: 'BRL', show_food_prices: true },
  });

  assert.equal(result.lines[0].unitPrice, 8);
  assert.equal(result.lines[0].purchaseCost, 8);
  assert.equal(result.foodCost, 0.32);
  assert.equal(result.knownFoodCost, 0.32);
  assert.equal(result.productionCost, 2);
  assert.equal(result.markupAmount, 1);
  assert.equal(result.appFeeAmount, 0.2);
});
