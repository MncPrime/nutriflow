import test from 'node:test';
import assert from 'node:assert/strict';
import {
  priceKey, resolvePrice, toRawQuantity, calculatePurchase,
  chooseAlternative, aggregateItems,
} from './pricing-engine.js';

const base = (overrides = {}) => ({
  foodId: 'banana',
  prescribedQuantity: 90,
  prescribedUnit: 'g',
  cooking: { factor: 1 },
  pricing: { unit: 'kg', price: 8, estimated: true },
  purchase: { packageQuantity: 1, packageUnit: 'kg' },
  ...overrides,
});

test('price key separates the same food by purchase unit', () => {
  assert.equal(priceKey('banana', 'kg'), 'banana|kg');
  assert.equal(priceKey('banana', 'un'), 'banana|un');
});

test('user price override only applies to the exact food/unit key', () => {
  const result = resolvePrice(
    { foodId: 'banana', unit: 'kg', price: 8 },
    { 'banana|kg': 7.5, 'banana|un': 2 }
  );
  assert.equal(result.value, 7.5);
  assert.equal(result.source, 'user');
});

test('zero is a valid explicit price and null is not an override', () => {
  assert.equal(resolvePrice({ foodId: 'banana', unit: 'kg', price: 8 }, { 'banana|kg': 0 }).value, 0);
  assert.equal(resolvePrice({ foodId: 'banana', unit: 'kg', price: 8 }, { 'banana|kg': null }).value, 8);
});

test('liquid quantities convert between milliliters and liters without density assumptions', () => {
  const result = calculatePurchase(base({
    prescribedQuantity: 250,
    prescribedUnit: 'ml',
    pricing: { unit: 'l', price: 5 },
    purchase: { packageQuantity: 1, packageUnit: 'l' },
  }));
  assert.equal(result.requiredQuantity, 0.25);
  assert.equal(result.purchaseQuantity, 1);
  assert.equal(result.consumedCost, 1.25);
  assert.equal(result.purchaseCost, 5);
});

test('cooked quantity converts to raw quantity using food-specific factor', () => {
  assert.equal(toRawQuantity(base({ prescribedQuantity: 90, cooking: { factor: 2.5 } })).quantity, 36);
});

test('purchase cost uses package rounding and exposes excess cost', () => {
  const result = calculatePurchase(base({ purchase: { packageQuantity: 500, packageUnit: 'g' } }));
  assert.equal(result.purchaseQuantity, 0.5);
  assert.equal(result.purchaseCost, 4);
  assert.equal(result.consumedCost, 0.72);
  assert.ok(Math.abs(result.excessCost - 3.28) < 1e-9);
});

test('unit products can use package quantities without mixing with grams', () => {
  const result = calculatePurchase(base({
    foodId: 'ovo', prescribedQuantity: 3, prescribedUnit: 'un',
    pricing: { unit: 'un', price: 1 },
    purchase: { packageQuantity: 12, packageUnit: 'un' },
  }));
  assert.equal(result.purchaseQuantity, 12);
  assert.equal(result.purchaseCost, 12);
  assert.equal(result.consumedCost, 3);
});

test('economy mode compares actual purchase cost, not proportional consumption cost', () => {
  const a = base({ foodId: 'a', pricing: { unit: 'kg', price: 10 }, purchase: { packageQuantity: 1000, packageUnit: 'g' } });
  const b = base({ foodId: 'b', pricing: { unit: 'kg', price: 8 }, purchase: { packageQuantity: 200, packageUnit: 'g' } });
  assert.equal(chooseAlternative([a, b], 'eco').foodId, 'b');
});

test('aggregation keeps food identity and unit identity', () => {
  const lines = aggregateItems([
    base({ prescribedQuantity: 90 }),
    base({ prescribedQuantity: 90 }),
    base({
      foodId: 'ovo', prescribedQuantity: 1, prescribedUnit: 'un',
      pricing: { unit: 'un', price: 1 },
      purchase: { packageQuantity: 12, packageUnit: 'un' },
    }),
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines.find(item => item.foodId === 'banana').rawQuantity, 180);
  assert.equal(lines.find(item => item.foodId === 'ovo').rawQuantity, 1);
});

test('aggregation rounds packaging after summing demand', () => {
  const lines = aggregateItems([
    base({ prescribedQuantity: 90, purchase: { packageQuantity: 500, packageUnit: 'g' } }),
    base({ prescribedQuantity: 90, purchase: { packageQuantity: 500, packageUnit: 'g' } }),
  ]);
  assert.equal(lines[0].rawQuantity, 180);
  assert.equal(lines[0].purchaseQuantity, 0.5);
  assert.equal(lines[0].packages, 1);
  assert.equal(lines[0].purchaseCost, 4);
});
