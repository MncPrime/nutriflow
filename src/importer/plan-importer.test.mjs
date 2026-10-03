import test from 'node:test';
import assert from 'node:assert/strict';
import { structurePlan, parseEntryText } from './plan-structurer.js';
import { validateDraft } from './plan-validator.js';
import { serializeDraft } from './plan-serializer.js';
import { MANUAL_OPTION_NEW, createSession, updateManualField, addEntries, previewQuick, validateManualForm, effectiveCategory, serializeManualDraft, restoreManualDraft, planSignature, suggestOptionName, syncManualOption } from './import-session.js';
import { renderManual } from './review-view.js';
import { buildDraft } from './import-session.js';
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
import { searchFoods, findSimilarFood } from './food-search.js';

test('detects whether text looks like a meal plan', () => {
  assert.equal(isLikelyPlan('Contrato de prestação de serviços. Página 1.'), false);
  assert.equal(isLikelyPlan(SAMPLE), true);
});

test('searches approved catalog foods by prefix or word', () => {
  const snapshot = { approved_foods: [{ id: 1, canonical_name: 'Frango grelhado' }, { id: 2, canonical_name: 'Peito de frango' }, { id: 3, canonical_name: 'Arroz' }] };
  assert.deepEqual(searchFoods('fran', snapshot).map(f => f.id), [1, 2]);
  assert.deepEqual(searchFoods('frango', snapshot).map(f => f.id), [1, 2]);
});

test('search uses real snapshot shape with aliases, accents and typos', () => {
  const snapshot = {
    foods: [{ id: 1, canonical_name: 'Frango grelhado', approval_status: 'approved' }, { id: 2, canonical_name: 'Feijão carioca', approval_status: 'approved' }],
    aliases: [{ food_id: 2, alias: 'Feijao preto' }],
  };
  assert.deepEqual(searchFoods('feijao', snapshot).map(f => f.id), [2]);
  assert.equal(searchFoods('feijao preto', snapshot)[0].matchedAlias, 'Feijao preto');
  assert.deepEqual(searchFoods('frnago grelhado', snapshot).map(f => f.id), [1]);
  assert.equal(findSimilarFood('Frango grelhado', snapshot), null);
  assert.equal(findSimilarFood('frango grelhdo', snapshot).label, 'Frango grelhado');
  assert.equal(findSimilarFood('maçã', snapshot), null);
});

test('manual form state keeps meal name, quantity, and unit through independent updates', () => {
  const session = createSession();
  updateManualField(session, 'manualMealName', 'Café da manhã');
  updateManualField(session, 'manualQuantity', '150');
  updateManualField(session, 'manualUnit', 'g');
  updateManualField(session, 'manualSubstitution', 'separate');
  updateManualField(session, 'manualQuantity', '180');
  assert.deepEqual(
    [session.manualMealName, session.manualQuantity, session.manualUnit, session.manualSubstitution],
    ['Café da manhã', '180', 'g', 'separate'],
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

test('manual form mostra seletor de opção para refeição existente', () => {
  const session = createSession();
  session.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  session.manualMeal = session.draft.meals[0].id;
  session.manualOption = session.draft.meals[0].opts[0].id;
  const html = renderManual(session, value => String(value), session.draft.meals, []);
  assert.match(html, /Opção da refeição/);
  assert.match(html, /Criar nova opção/);
});

test('manual additions auto-group alternatives by category in the same meal', () => {
  const session = createSession();
  session.draft = structurePlan('# Almoço | 12:00');

  addEntries(session, '', 'Almoço', previewQuick('100 g frango grelhado'));
  const result = addEntries(session, '', 'Almoço', previewQuick('130 g patinho moído'));

  const meal = result.meal;
  assert.equal(meal.opts[0].entries.length, 1);
  assert.equal(meal.opts[0].entries[0].alts.length, 2);
  assert.deepEqual(
    meal.opts[0].entries[0].alts.map(alt => alt.name),
    ['frango grelhado', 'patinho moído'],
  );
});

test('manual substitution mode can keep entries separate', () => {
  const session = createSession();
  session.draft = structurePlan('# Almoço | 12:00');

  addEntries(session, '', 'Almoço', previewQuick('100 g frango grelhado'));
  const result = addEntries(session, '', 'Almoço', previewQuick('130 g patinho moído'), undefined, 'separate');

  assert.equal(result.groupedCount, 0);
  assert.equal(result.separateCount, 1);
  assert.equal(result.meal.opts[0].entries.length, 2);
});

function formState(over = {}) {
  const s = createSession();
  Object.assign(s, { mode: 'manual', manualMeal: 'new', manualMealName: 'Almoço', ...over });
  s.quickPreview = s.quick ? previewQuick(`${s.manualQuantity} g ${s.quick}`) : null;
  return s;
}

test('formulário manual valida mínimos e categoria obrigatória', () => {
  assert.equal(validateManualForm(formState()).ok, false);
  const short = validateManualForm(formState({ quick: 'ab', manualQuantity: '100', manualMealName: 'Al' }));
  assert.ok(short.errors.food && short.errors.meal);
  const unknown = formState({ quick: 'xyzzy', manualQuantity: '100' });
  assert.ok(validateManualForm(unknown).errors.category);
  assert.equal(validateManualForm({ ...unknown, guidedCategory: 'other' }).ok, true);
  assert.equal(validateManualForm(formState({ quick: 'frango', manualQuantity: '100' })).ok, true);
});

test('categoria é sugerida ao digitar e o usuário pode trocar', () => {
  const s = formState({ quick: 'frango grelhado', manualQuantity: '100' });
  assert.deepEqual(effectiveCategory(s), { category: 'protein', suggested: true });
  s.guidedCategory = 'fat';
  assert.deepEqual(effectiveCategory(s), { category: 'fat', suggested: false });
  assert.ok(!renderManual(s, x => x, [], []).includes('(opcional)'));
});

test('rascunho do formulário é salvo e restaurado', () => {
  const s = formState({ quick: 'arroz', manualQuantity: '100' });
  s.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  s.manualMeal = s.draft.meals[0].id;
  s.manualOption = s.draft.meals[0].opts[0].id;
  const raw = serializeManualDraft(s);
  assert.ok(raw);
  const r = createSession();
  r.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  assert.equal(restoreManualDraft(r, raw), true);
  assert.equal(r.quick, 'arroz');
  assert.equal(restoreManualDraft(createSession(), '{bad'), false);
  assert.equal(serializeManualDraft(createSession()), null);
});

test('inclusão manual direta preserva índices existentes e agrupa por categoria', () => {
  const plan = '# Almoço | 12:00\n150 g arroz\n130 g frango\n# Jantar\n100 g feijão';
  const cat = () => ({});
  const base = parsePlanText(plan, cat).meals;
  const session = createSession();
  session.draft = buildDraft(plan, {}).draft;
  const meal = session.draft.meals[0];
  const entries = previewQuick('130 g patinho');
  entries.forEach(entry => entry.alts.forEach(alt => { alt.category = 'protein'; alt.categoryLocked = true; }));
  const result = addEntries(session, meal.id, '', entries, {}, 'auto');
  assert.equal(result.groupedCount, 1);
  const next = parsePlanText(serializeDraft(session.draft).text, cat).meals;
  assert.equal(planSignature(base).length > 0, true);
  assert.deepEqual(next[0].opts[0].comps.map(c => c.alts.length), [1, 2]);
  assert.deepEqual(next.slice(1).map(m => m.opts[0].comps.length), base.slice(1).map(m => m.opts[0].comps.length));
});

test('inclusão manual escolhe opção existente da refeição', () => {
  const session = createSession();
  session.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz\n## Opção 2\n100 g banana');
  const meal = session.draft.meals[0];
  const optionTwo = meal.opts[1];
  const result = addEntries(
    session,
    meal.id,
    '',
    previewQuick('80 g granola'),
    {},
    'separate',
    { optionId: optionTwo.id, optionName: '' },
  );
  assert.equal(result.option.id, optionTwo.id);
  assert.equal(meal.opts[0].entries.length, 1);
  assert.equal(meal.opts[1].entries.length, 2);
});

test('inclusão manual cria nova opção com nome sugerido', () => {
  const session = createSession();
  session.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  const meal = session.draft.meals[0];
  const autoName = suggestOptionName(meal);
  const result = addEntries(
    session,
    meal.id,
    '',
    previewQuick('120 g mamão'),
    {},
    'separate',
    { optionId: MANUAL_OPTION_NEW, optionName: autoName },
  );
  assert.equal(result.option.name, 'Opção 2');
  assert.equal(meal.opts.length, 2);
  assert.equal(meal.opts[1].entries.length, 1);
});

test('agrupamento automático respeita apenas a opção selecionada', () => {
  const session = createSession();
  session.draft = structurePlan('# Almoço\n## Opção 1\n100 g frango\n## Opção 2\n130 g patinho');
  const meal = session.draft.meals[0];
  const optionTwo = meal.opts[1];
  const result = addEntries(
    session,
    meal.id,
    '',
    previewQuick('140 g peixe'),
    {},
    'auto',
    { optionId: optionTwo.id, optionName: '' },
  );
  assert.equal(result.groupedCount, 1);
  assert.equal(meal.opts[0].entries[0].alts.length, 1);
  assert.equal(meal.opts[1].entries.length, 1);
  assert.equal(meal.opts[1].entries[0].alts.length, 2);
});

test('opção nova exige nome válido na validação do formulário', () => {
  const session = formState({ quick: 'frango', manualQuantity: '100' });
  session.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  session.manualMeal = session.draft.meals[0].id;
  session.manualOption = MANUAL_OPTION_NEW;
  session.manualOptionName = 'AB';
  assert.ok(validateManualForm(session).errors.option);
  session.manualOptionName = 'Opção 2';
  assert.equal(validateManualForm(session).errors.option, undefined);
});

test('syncManualOption mantém opção válida para a refeição selecionada', () => {
  const session = createSession();
  session.draft = structurePlan('# Lanche\n## Opção 1\n100 g arroz');
  session.manualMeal = session.draft.meals[0].id;
  session.manualOption = '';
  syncManualOption(session);
  assert.equal(session.manualOption, session.draft.meals[0].opts[0].id);
});
