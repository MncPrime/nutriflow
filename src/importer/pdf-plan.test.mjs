import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPlanSchedules } from './pdf-plan.js';
import { structurePlan } from './plan-structurer.js';
import { validateDraft } from './plan-validator.js';

const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

test('rebuilds positioned meal columns and keeps alternate schedules separate', () => {
  const pages = [{ items: [
    item('Diurno e Terra - 06:00 às 18:00', 217, 900),
    item('Hora: 06:00', 214, 880),
    item('1 und. méd. - Banana ou 1/2 mamão papaia médio (150 g)', 168, 865),
    item('CAFÉ DA MANHÃ', 60, 850),
    item('+ 1 colher de sobremesa (10g) de farelo de aveia', 153, 840),
    item('+ 1 xícara de café com 1 col. de chá (5g) de açúcar', 153, 825),
    item('Hora: 10:00', 214, 800),
    item('Opção 1', 153, 785),
    item('1 unidade (170 g) - Iogurte', 153, 770),
    item('LANCHE DA', 73, 755),
    item('MANHÃ', 73, 740),
    item('Hora: 12:00', 214, 720),
    item('ALMOÇO', 79, 700),
    item('90 g - Arroz integral ou', 153, 685),
    item('Arroz branco', 153, 670),
    item('(110 g) - 2 colheres de servir de legumes e verduras cozidos -', 153, 650),
    item('Opções de legumes: cenoura, abobrinha, tomate', 153, 635),
    item('Hora: 19:00', 214, 615),
    item('JANTAR', 82, 595),
    item('Madrugada - 00:00 às 12:00', 223, 575),
    item('Hora: 06:00', 214, 555),
    item('CAFÉ DA MANHÃ', 60, 540),
    item('3 ovos mexidos', 153, 525),
    item('Noturno - 12:00 às 00:00', 231, 500),
    item('Hora: 12:00', 214, 480),
    item('ALMOÇO', 79, 465),
    item('2 ovos mexidos', 153, 450),
  ] }];

  const schedules = extractPlanSchedules(pages);
  assert.deepEqual(schedules.map(schedule => schedule.name), ['Diurno e Terra', 'Madrugada', 'Noturno']);

  const dayDraft = structurePlan(schedules[0].text);
  assert.deepEqual(dayDraft.meals.map(meal => [meal.name, meal.time]), [
    ['Café da manhã', '06:00'],
    ['Lanche da manhã', '10:00'],
    ['Almoço', '12:00'],
  ]);
  const breakfast = dayDraft.meals[0].opts[0].entries;
  assert.deepEqual(breakfast[0].alts.map(alt => [alt.name, alt.quantity, alt.unit]), [
    ['Banana', 1, 'un'],
    ['mamão papaia', 150, 'g'],
  ]);
  assert.deepEqual(breakfast.slice(1).flatMap(entry => entry.alts).map(alt => [alt.name, alt.quantity, alt.unit]), [
    ['farelo de aveia', 10, 'g'],
    ['café', 1, 'un'],
    ['açúcar', 5, 'g'],
  ]);
  const lunch = dayDraft.meals[2].opts[0].entries;
  assert.deepEqual(lunch[0].alts.map(alt => [alt.name, alt.quantity, alt.unit]), [
    ['Arroz integral', 90, 'g'],
    ['Arroz branco', 90, 'g'],
  ]);
  assert.match(lunch.at(-1).alts.map(alt => alt.name).join(' '), /cenoura.*abobrinha.*tomate/);
  assert.equal(validateDraft(dayDraft).blocked, 0);

  const nightDraft = structurePlan(schedules[1].text);
  assert.deepEqual(nightDraft.meals.map(meal => meal.time), ['06:00']);
  const thirdShift = structurePlan(schedules[2].text);
  assert.deepEqual(thirdShift.meals.map(meal => [meal.name, meal.time]), [['Almoço', '12:00']]);
});
