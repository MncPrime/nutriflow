import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanText } from './plan-parser.js';

const category = () => 'out';

test('accepts common unit aliases and converts kg and liters', () => {
  const result = parsePlanText('# Café\n150 gr mamão\n1 litro leite\n2 unidades ovo', category);
  const [papaya, milk, eggs] = result.meals[0].opts[0].comps.map(item => item.alts[0]);
  assert.equal(papaya.g, 150);
  assert.equal(milk.ml, 1000);
  assert.equal(eggs.n, 2);
  assert.equal(result.warnings.length, 0);
});

test('keeps alternatives without a repeated quantity and reports unsupported units', () => {
  const result = parsePlanText('# Almoço\n100 g arroz ou batata\n2 colheres azeite', category);
  const alternatives = result.meals[0].opts[0].comps[0].alts;
  assert.equal(alternatives.length, 2);
  assert.equal(alternatives[1].g, 100);
  assert.match(result.warnings.join('\n'), /colheres/);
});
