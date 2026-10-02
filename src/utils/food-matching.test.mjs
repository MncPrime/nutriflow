import test from 'node:test';
import assert from 'node:assert/strict';
import { matchFoodName, sanitizeFoodName } from './food-matching.js';

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
