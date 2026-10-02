import { classifyFood } from './food-classifier.js';
import { SUPPORTED_UNITS } from './plan-structurer.js';

const RANK = { low: 0, medium: 1, high: 2 };

export function validateAlternative(alt, { isKnownFood } = {}) {
  const issues = [];
  let confidence = 'high';
  const lower = level => { if (RANK[level] < RANK[confidence]) confidence = level; };
  if (!alt.categoryLocked) alt.category = classifyFood(alt.name);
  if (!alt.name || !/\p{L}{2,}/u.test(alt.name)) { issues.push('Alimento não identificado.'); lower('low'); }
  if (alt.unsupportedUnit) { issues.push(`Unidade “${alt.unsupportedUnit}” não suportada. Use g, ml, un ou fatias.`); lower('low'); }
  else if (!(alt.quantity > 0)) { issues.push('Quantidade não identificada.'); lower('low'); }
  else if (!SUPPORTED_UNITS.includes(alt.unit)) { issues.push('Unidade não reconhecida.'); lower('low'); }
  if (alt.inherited && confidence !== 'low') { issues.push('Quantidade herdada da alternativa anterior.'); lower('medium'); }
  if (alt.estimated && confidence !== 'low') { issues.push('Quantidade encontrada no meio do texto. Confira.'); lower('medium'); }
  if (alt.category === 'other' && confidence !== 'low') { issues.push('Categoria não identificada.'); lower('medium'); }
  if (isKnownFood && alt.name && !isKnownFood(alt.name) && confidence !== 'low') { issues.push('Não encontrado no catálogo.'); lower('medium'); }
  alt.issues = issues;
  alt.confidence = confidence;
  alt.valid = confidence !== 'low';
  return alt;
}

export function validateDraft(draft, options = {}) {
  let foods = 0;
  let groups = 0;
  let review = 0;
  for (const meal of draft.meals) {
    for (const opt of meal.opts) {
      for (const entry of opt.entries) {
        if (entry.alts.length > 1) groups += 1;
        for (const alt of entry.alts) {
          validateAlternative(alt, options);
          foods += 1;
          if (alt.confidence !== 'high') review += 1;
        }
      }
    }
  }
  return { meals: draft.meals.length, foods, groups, review, blocked: countBlocked(draft) };
}

export function countBlocked(draft) {
  let blocked = 0;
  for (const meal of draft.meals) for (const opt of meal.opts) for (const entry of opt.entries) {
    if (!entry.alts.some(alt => alt.valid)) blocked += 1;
  }
  return blocked;
}
