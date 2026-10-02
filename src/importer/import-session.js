import { structurePlan, parseEntryText, parseAlternativeText, newId, SUPPORTED_UNITS } from './plan-structurer.js';
import { validateDraft } from './plan-validator.js';
import { serializeDraft } from './plan-serializer.js';
import { splitPreparation, classifyFood } from './food-classifier.js';

export const createSession = () => ({ mode: '', text: '', draft: null, stats: null, loading: false, error: '', source: 'text', fileName: '', pdfSchedules: [], pdfPages: 0, quick: '', quickPreview: null, guidedCategory: '', manualMeal: 'new', manualMealName: '', manualQuantity: '', manualUnit: 'g', manualCategoryOpen: false });

export function buildDraft(text, options) {
  const draft = structurePlan(text);
  return { draft, stats: validateDraft(draft, options) };
}

export function refresh(session, options) {
  session.stats = validateDraft(session.draft, options);
}

function* walk(draft) {
  for (const meal of draft.meals) for (const opt of meal.opts) for (const entry of opt.entries) for (const alt of entry.alts) yield { meal, opt, entry, alt };
}

function prune(draft) {
  for (const meal of draft.meals) {
    for (const opt of meal.opts) opt.entries = opt.entries.filter(entry => entry.alts.length);
    meal.opts = meal.opts.filter(opt => opt.entries.length);
  }
}

export function updateAlt(session, id, field, value, options) {
  for (const { alt } of walk(session.draft)) {
    if (alt.id !== id) continue;
    if (field === 'name') {
      alt.name = String(value).trim();
      const { food, preparation } = splitPreparation(alt.name);
      alt.food = food;
      alt.preparation = preparation;
      alt.category = classifyFood(alt.name);
    } else if (field === 'quantity') {
      const parsed = Number(String(value).replace(',', '.'));
      alt.quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      alt.inherited = false;
      alt.estimated = false;
    } else if (field === 'unit' && SUPPORTED_UNITS.includes(value)) {
      alt.unit = value;
      alt.unsupportedUnit = '';
    }
    break;
  }
  refresh(session, options);
}

export function removeAlt(session, id, options) {
  for (const { entry } of walk(session.draft)) {
    const index = entry.alts.findIndex(alt => alt.id === id);
    if (index >= 0) { entry.alts.splice(index, 1); break; }
  }
  prune(session.draft);
  refresh(session, options);
}

export function updateMeal(session, id, field, value) {
  const meal = session.draft.meals.find(item => item.id === id);
  if (meal && (field === 'name' || field === 'time')) meal[field] = String(value).trim();
}

export function removeMeal(session, id, options) {
  session.draft.meals = session.draft.meals.filter(meal => meal.id !== id);
  refresh(session, options);
}

export function previewQuick(text) {
  const entries = parseEntryText(text);
  entries.forEach(entry => entry.alts.forEach(alt => { alt.valid = alt.quantity > 0 && !alt.unsupportedUnit && Boolean(alt.name); }));
  return entries;
}

export function updateManualField(session, field, value) {
  if (!['manualMealName', 'manualQuantity', 'manualUnit'].includes(field)) {
    throw new TypeError(`Campo manual desconhecido: ${field}`);
  }
  session[field] = String(value);
}

export function addEntries(session, mealId, newMealName, entries, options) {
  let meal = session.draft.meals.find(item => item.id === mealId);
  if (!meal) {
    const name = String(newMealName || '').trim();
    if (!name) return { error: 'Informe o nome da refeição.' };
    meal = session.draft.meals.find(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (!meal) { meal = { id: newId(), name, time: '', opts: [], notes: [] }; session.draft.meals.push(meal); }
  }
  if (!meal.opts.length) meal.opts.push({ id: newId(), name: '', entries: [] });
  meal.opts[0].entries.push(...entries);
  refresh(session, options);
  return { meal };
}

export function guidedEntry(food, quantity, unit) {
  const text = `${String(quantity).replace('.', ',')} ${unit} ${food}`;
  return parseEntryText(text);
}

export { serializeDraft, parseAlternativeText };
