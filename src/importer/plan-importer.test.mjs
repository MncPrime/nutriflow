import test from 'node:test';
import assert from 'node:assert/strict';
import { structurePlan, parseEntryText } from './plan-structurer.js';
import { validateDraft } from './plan-validator.js';
import { serializeDraft } from './plan-serializer.js';
import { createSession, updateManualField, addEntries, previewQuick } from './import-session.js';
import { renderManual } from './review-view.js';
import { classifyFood } from './food-classifier.js';
import { parsePlanText } from '../domain/plan-parser.js';

const SAMPLE = `Café da manhã | 06:00

1 un banana ou 150g mamão papaia
10g farelo de aveia
2 fatias pão de forma integral ou 1 un pão francês
40g queijo minas frescal ou 30g mussarela
3 ovos mexidos
café + 5g açúcar`;
const summary = alts => alts.map(a => [a.name, a.quantity, a.unit]);

test('structures the breakfast example with substitution groups', () => {
  const { meals } = structurePlan(SAMPLE);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].name, 'Café da manhã');
  assert.equal(meals[0].time, '06:00');
  const entries = meals[0].opts[0].entries;
  assert.equal(entries.length, 6);
  assert.deepEqual(summary(entries[0].alts), [['banana', 1, 'un'], ['mamão papaia', 150, 'g']]);
  assert.deepEqual(summary(entries[1].alts), [['farelo de aveia', 10, 'g']]);
  assert.deepEqual(summary(entries[2].alts), [['pão de forma integral', 2, 'fatias'], ['pão francês', 1, 'un']]);
  assert.deepEqual(summary(entries[3].alts), [['queijo minas frescal', 40, 'g'], ['mussarela', 30, 'g']]);
  assert.deepEqual(summary(entries[4].alts), [['ovos mexidos', 3, 'un']]);
  assert.deepEqual(summary(entries[5].alts), [['café + açúcar', 5, 'g']]);
});

test('splits "+" only when every part has a quantity', () => {
  const entries = parseEntryText('2 ovos + 1 banana + 30g aveia');
  assert.deepEqual(entries.map(e => summary(e.alts)[0]), [['ovos', 2, 'un'], ['banana', 1, 'un'], ['aveia', 30, 'g']]);
  assert.deepEqual(entries.map(e => e.alts[0].category), ['protein', 'fruit', 'carbohydrate']);
});

test('extracts preparation without losing the typed name', () => {
  const [entry] = parseEntryText('150g frango grelhado');
  assert.equal(entry.alts[0].food, 'frango');
  assert.equal(entry.alts[0].preparation, 'grelhado');
  assert.equal(entry.alts[0].name, 'frango grelhado');
});

test('never invents a missing quantity and flags low confidence', () => {
  const draft = structurePlan('Almoço - 12:30\n1 porção de proteína\nsalada crua à vontade\n2 colheres azeite');
  const stats = validateDraft(draft);
  const alts = draft.meals[0].opts[0].entries.flatMap(e => e.alts);
  assert.equal(draft.meals[0].time, '12:30');
  assert.ok(alts.every(a => a.confidence === 'low'));
  assert.equal(stats.blocked, 3);
  assert.equal(serializeDraft(draft).text, '');
});

test('counts meals, foods and substitution groups', () => {
  const stats = validateDraft(structurePlan(SAMPLE));
  assert.deepEqual([stats.meals, stats.foods, stats.groups], [1, 9, 3]);
});

test('serialized text round-trips through the existing parser', () => {
  const draft = structurePlan(SAMPLE);
  validateDraft(draft);
  const { text } = serializeDraft(draft);
  const parsed = parsePlanText(text, () => 'out');
  assert.equal(parsed.warnings.length, 0);
  const comps = parsed.meals[0].opts[0].comps;
  assert.equal(comps.length, 6);
  assert.equal(comps[0].alts.length, 2);
  assert.equal(comps[0].alts[1].g, 150);
  assert.equal(comps[2].alts[0].n, 2);
});

test('legacy DSL plans survive structure -> serialize -> parse', () => {
  const legacy = '# Lanche | 10:00\n## Opção 1\n2 un ovo\n## Opção 2\n150 g mamão ou 1 un banana';
  const draft = structurePlan(legacy);
  validateDraft(draft);
  const parsed = parsePlanText(serializeDraft(draft).text, () => 'out');
  assert.equal(parsed.meals[0].opts.length, 2);
  assert.equal(parsed.meals[0].opts[1].comps[0].alts.length, 2);
});

test('classifies common foods', () => {
  assert.equal(classifyFood('30g whey'), 'supplement');
  assert.equal(classifyFood('arroz'), 'carbohydrate');
  assert.equal(classifyFood('feijão'), 'legume');
  assert.equal(classifyFood('azeite'), 'fat');
  assert.equal(classifyFood('xyz'), 'other');
});

import { groupItemsIntoLines } from './pdf-lines.js';

test('rebuilds PDF table rows by position', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const lines = groupItemsIntoLines([item('150g', 300, 700), item('Frango grelhado', 50, 701), item('Café da manhã', 50, 740), item('Arroz', 50, 680), item('100g', 300, 680)]);
  assert.deepEqual(lines, ['Café da manhã', 'Frango grelhado 150g', 'Arroz 100g']);
});

import { isLikelyPlan } from './plan-detector.js';
import { searchFoods } from './food-search.js';

test('detects whether text looks like a meal plan', () => {
  assert.equal(isLikelyPlan('Contrato de prestação de serviços. Página 1.'), false);
  assert.equal(isLikelyPlan(SAMPLE), true);
});

test('searches approved catalog foods by prefix or word', () => {
  const snapshot = { approved_foods: [{ id: 1, canonical_name: 'Frango grelhado' }, { id: 2, canonical_name: 'Peito de frango' }, { id: 3, canonical_name: 'Arroz' }] };
  assert.deepEqual(searchFoods('fran', snapshot).map(f => f.id), [1]);
  assert.deepEqual(searchFoods('frango', snapshot).map(f => f.id), [1, 2]);
});

test('manual form state keeps meal name, quantity, and unit through independent updates', () => {
  const session = createSession();
  updateManualField(session, 'manualMealName', 'Café da manhã');
  updateManualField(session, 'manualQuantity', '150');
  updateManualField(session, 'manualUnit', 'g');
  updateManualField(session, 'manualQuantity', '180');
  assert.deepEqual(
    [session.manualMealName, session.manualQuantity, session.manualUnit],
    ['Café da manhã', '180', 'g'],
  );
  assert.throws(() => updateManualField(session, 'unknown', 'value'), TypeError);
});

test('manual form renders entered values and adds an item to the named meal', () => {
  const session = createSession();
  updateManualField(session, 'manualMealName', 'Lanche da tarde');
  updateManualField(session, 'manualQuantity', '30');
  updateManualField(session, 'manualUnit', 'g');
  session.quick = 'whey protein';
  session.quickPreview = previewQuick('30 g whey protein');
  session.draft = structurePlan('');
  const html = renderManual(session, value => String(value), [], []);
  assert.match(html, /value="Lanche da tarde"/);
  assert.match(html, /value="30"/);
  assert.match(html, /<option value="g" selected>g<\/option>/);

  const result = addEntries(session, '', session.manualMealName, previewQuick('30 g whey protein'));
  assert.equal(result.meal.name, 'Lanche da tarde');
  assert.equal(result.meal.opts[0].entries[0].alts[0].name, 'whey protein');
});
