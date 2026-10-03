import test from 'node:test';
import assert from 'node:assert/strict';
import { matchFoodName, sanitizeFoodName, foodKey, findDuplicateFood } from './food-matching.js';

test('sanitizes accents and punctuation', () => {
  assert.equal(sanitizeFoodName('Filé de Peito de Frango Grelhado!'), 'file de peito de frango grelhado');
});

test('matches aliases exactly after normalization', () => {
  const result = matchFoodName('mussarela', [{ id: 'cheese-1', name: 'Queijo Muçarela', aliases: ['mussarela'] }]);
  assert.equal(result.strategy, 'exact');
  assert.equal(result.item.id, 'cheese-1');
});

test('uses fuzzy matching before pending', () => {
  const result = matchFoodName('file de peito de frango grelhdo', [{ id: 'chicken', name: 'Filé de peito de frango grelhado' }]);
  assert.equal(result.strategy, 'fuzzy');
  assert.equal(result.item.id, 'chicken');
});

test('returns pending when confidence is insufficient', () => {
  const result = matchFoodName('produto sem relacao', [{ id: 'rice', name: 'Arroz integral' }]);
  assert.equal(result.status, 'pending');
});

test('foodKey treats plural, accents and connectors as the same food', () => {
  assert.equal(foodKey('Ovo mexido'), foodKey('ovos mexidos'));
  assert.equal(foodKey('Pão de forma'), foodKey('paes forma'));
  assert.equal(foodKey('Legumes'), foodKey('legume'));
  assert.notEqual(foodKey('Frango grelhado'), foodKey('Frango assado'));
});

test('findDuplicateFood detects exact (plural), alias and similar names', () => {
  const foods = [{ id: 'a', canonical_name: 'Ovo mexido' }, { id: 'b', canonical_name: 'Frango grelhado' }];
  const aliases = [{ food_id: 'b', alias: 'Frango na chapa' }];
  assert.equal(findDuplicateFood('ovos mexidos', foods, aliases).kind, 'exact');
  assert.equal(findDuplicateFood('Frango na chapa', foods, aliases).food.id, 'b');
  assert.equal(findDuplicateFood('frango grelhdo', foods, aliases).kind, 'similar');
  assert.equal(findDuplicateFood('Ovo mexido', foods, aliases, { excludeId: 'a' }), null);
  assert.equal(findDuplicateFood('Arroz', foods, aliases), null);
});
