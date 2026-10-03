import { structurePlan, parseEntryText, parseAlternativeText, newId, SUPPORTED_UNITS } from './plan-structurer.js';
import { validateDraft } from './plan-validator.js';
import { serializeDraft } from './plan-serializer.js';
import { splitPreparation, classifyFood } from './food-classifier.js';

const SUBSTITUTION_MODES = new Set(['auto', 'force', 'separate']);
export const MANUAL_OPTION_NEW = '__new_option__';

export const createSession = () => ({ mode: '', text: '', draft: null, stats: null, loading: false, error: '', source: 'text', fileName: '', pdfSchedules: [], pdfPages: 0, quick: '', quickPreview: null, guidedCategory: '', manualMeal: 'new', manualMealName: '', manualOption: '', manualOptionName: '', manualQuantity: '', manualUnit: 'g', manualSubstitution: 'auto', manualTouched: false, pendingDraft: false });

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

const letterCount = text => (String(text ?? '').match(/\p{L}/gu) || []).length;
export const MIN_NAME_LENGTH = 3;

export function effectiveCategory(state, preview = state.quickPreview) {
  if (state.guidedCategory) return { category: state.guidedCategory, suggested: false };
  const name = preview?.[0]?.alts?.[0]?.name || '';
  const guess = name ? classifyFood(name) : 'other';
  return guess === 'other' ? { category: '', suggested: false } : { category: guess, suggested: true };
}

export function validateManualForm(state) {
  const errors = {};
  if (!state.manualMeal || state.manualMeal === 'new') {
    const meal = String(state.manualMealName ?? '').trim();
    if (letterCount(meal) < MIN_NAME_LENGTH) errors.meal = `Nome da refeição com pelo menos ${MIN_NAME_LENGTH} letras.`;
  }
  const alts = state.quickPreview?.flatMap(entry => entry.alts) || [];
  if (!alts.length || alts.some(alt => letterCount(alt.name) < MIN_NAME_LENGTH)) errors.food = `Nome do alimento com pelo menos ${MIN_NAME_LENGTH} letras.`;
  if (alts.length && alts.some(alt => !(alt.quantity > 0) || alt.unsupportedUnit)) errors.qty = 'Informe uma quantidade maior que zero.';
  else if (!alts.length) errors.qty = 'Informe a quantidade.';
  if (!effectiveCategory(state).category) errors.category = 'Escolha a categoria do alimento.';
  if (state.manualMeal && state.manualMeal !== 'new' && state.manualOption === MANUAL_OPTION_NEW) {
    const optionName = String(state.manualOptionName ?? '').trim();
    if (letterCount(optionName) < MIN_NAME_LENGTH) errors.option = `Nome da opção com pelo menos ${MIN_NAME_LENGTH} letras.`;
  }
  return { errors, ok: Object.keys(errors).length === 0 };
}

const DRAFT_FIELDS = ['quick', 'manualMealName', 'manualOptionName', 'manualQuantity', 'manualUnit', 'manualSubstitution', 'guidedCategory'];

export function suggestOptionName(meal) {
  const taken = meal?.opts?.map(opt => Number(String(opt.name || '').match(/^op[çc][ãa]o\s+(\d+)$/iu)?.[1])).filter(Number.isFinite) || [];
  const next = (taken.length ? Math.max(...taken) : meal?.opts?.filter(opt => String(opt.name || '').trim()).length || 0) + 1;
  return `Opção ${next}`;
}

export function syncManualOption(session) {
  if (!session.manualMeal || session.manualMeal === 'new') {
    session.manualOption = '';
    return;
  }
  const meal = session.draft?.meals?.find(item => item.id === session.manualMeal);
  if (!meal) {
    session.manualOption = '';
    return;
  }
  if (session.manualOption === MANUAL_OPTION_NEW) {
    if (!String(session.manualOptionName || '').trim()) session.manualOptionName = suggestOptionName(meal);
    return;
  }
  if (meal.opts.some(opt => opt.id === session.manualOption)) return;
  session.manualOption = meal.opts[0]?.id || MANUAL_OPTION_NEW;
  if (session.manualOption === MANUAL_OPTION_NEW && !String(session.manualOptionName || '').trim()) {
    session.manualOptionName = suggestOptionName(meal);
  }
}

export function serializeManualDraft(state) {
  if (state.mode !== 'manual') return null;
  const hasForm = DRAFT_FIELDS.some(key => state[key] && !['g', 'auto'].includes(state[key]));
  const mealName = state.draft?.meals?.find(meal => meal.id === state.manualMeal)?.name || '';
  const optionName = state.draft?.meals?.find(meal => meal.id === state.manualMeal)?.opts?.find(opt => opt.id === state.manualOption)?.name || '';
  if (!hasForm) return null;
  const form = Object.fromEntries(DRAFT_FIELDS.map(key => [key, state[key]]));
  return JSON.stringify({ v: 3, form, mealName, optionName, manualOption: state.manualOption });
}

export function restoreManualDraft(state, raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return false; }
  if (!data || ![2, 3].includes(data.v) || typeof data.form !== 'object' || data.form === null) return false;
  for (const key of DRAFT_FIELDS) if (typeof data.form[key] === 'string') state[key] = data.form[key];
  if (!SUBSTITUTION_MODES.has(state.manualSubstitution)) state.manualSubstitution = 'auto';
  const meal = state.draft?.meals?.find(item => item.name === data.mealName);
  state.manualMeal = meal ? meal.id : 'new';
  state.manualOption = '';
  if (meal) {
    if (data.v === 3 && data.manualOption === MANUAL_OPTION_NEW) state.manualOption = MANUAL_OPTION_NEW;
    else state.manualOption = meal.opts.find(opt => opt.name === data.optionName)?.id || meal.opts[0]?.id || '';
  }
  state.mode = 'manual';
  syncManualOption(state);
  return true;
}

export function planSignature(meals) {
  return JSON.stringify(meals.map(meal => meal.opts.map(opt => opt.comps.map(comp => comp.alts.length))));
}

export function updateManualField(session, field, value) {
  if (!['manualMealName', 'manualOptionName', 'manualQuantity', 'manualUnit', 'manualSubstitution'].includes(field)) {
    throw new TypeError(`Campo manual desconhecido: ${field}`);
  }
  if (field === 'manualSubstitution') {
    const mode = String(value);
    session.manualSubstitution = SUBSTITUTION_MODES.has(mode) ? mode : 'auto';
    return;
  }
  session[field] = String(value);
}

function sameAlternative(a, b) {
  return a.name === b.name && a.unit === b.unit && a.quantity === b.quantity;
}

function findSubstitutionTarget(destinationEntries, alt, mode) {
  const sameCategory = destinationEntries.filter(entry =>
    entry.alts.length && entry.alts.every(current => current.category === alt.category));
  if (sameCategory.length) return sameCategory[sameCategory.length - 1];
  if (mode === 'force' && destinationEntries.length) return destinationEntries[destinationEntries.length - 1];
  return null;
}

function resolveDestinationOption(meal, optionSelection = {}) {
  const mode = optionSelection.optionId;
  if (mode === MANUAL_OPTION_NEW) {
    const candidate = String(optionSelection.optionName || suggestOptionName(meal)).trim();
    if (letterCount(candidate) < MIN_NAME_LENGTH) return { error: `Nome da opção com pelo menos ${MIN_NAME_LENGTH} letras.` };
    const existing = meal.opts.find(opt => String(opt.name || '').toLocaleLowerCase('pt-BR') === candidate.toLocaleLowerCase('pt-BR'));
    if (existing) return { option: existing };
    const option = { id: newId(), name: candidate, entries: [] };
    meal.opts.push(option);
    return { option };
  }
  if (!meal.opts.length) {
    const option = { id: newId(), name: '', entries: [] };
    meal.opts.push(option);
    return { option };
  }
  const existing = meal.opts.find(opt => opt.id === mode);
  return { option: existing || meal.opts[0] };
}

export function addEntries(session, mealId, newMealName, entries, options, substitutionMode = 'auto', optionSelection = {}) {
  let meal = session.draft.meals.find(item => item.id === mealId);
  if (!meal) {
    const name = String(newMealName || '').trim();
    if (!name) return { error: 'Informe o nome da refeição.' };
    meal = session.draft.meals.find(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (!meal) { meal = { id: newId(), name, time: '', opts: [], notes: [] }; session.draft.meals.push(meal); }
  }
  const destination = resolveDestinationOption(meal, optionSelection);
  if (destination.error) return { error: destination.error };
  const mode = SUBSTITUTION_MODES.has(substitutionMode) ? substitutionMode : 'auto';
  const destinationEntries = destination.option.entries;
  let groupedCount = 0;
  let separateCount = 0;
  let forceFallbackCount = 0;
  for (const entry of entries) {
    const candidate = entry.alts.length === 1 ? entry.alts[0] : null;
    const canGroup = mode !== 'separate' && candidate && candidate.valid !== false && candidate.category;
    if (!canGroup) {
      destinationEntries.push(entry);
      separateCount += 1;
      continue;
    }
    const target = findSubstitutionTarget(destinationEntries, candidate, mode);
    if (!target || target.alts.some(current => sameAlternative(current, candidate))) {
      destinationEntries.push(entry);
      separateCount += 1;
      continue;
    }
    if (mode === 'force' && !target.alts.every(current => current.category === candidate.category)) {
      forceFallbackCount += 1;
    }
    target.alts.push(candidate);
    groupedCount += 1;
  }
  refresh(session, options);
  return { meal, option: destination.option, groupedCount, separateCount, forceFallbackCount };
}

export function guidedEntry(food, quantity, unit) {
  const text = `${String(quantity).replace('.', ',')} ${unit} ${food}`;
  return parseEntryText(text);
}

export { serializeDraft, parseAlternativeText };
