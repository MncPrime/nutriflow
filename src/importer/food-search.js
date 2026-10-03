import { sanitizeFoodName, fuzzyFoodScore } from '../utils/food-matching.js';

const FUZZY_SUGGEST = 0.7;
const FUZZY_SIMILAR = 0.78;

function catalogFoods(snapshot) {
  return snapshot?.foods ?? snapshot?.approved_foods ?? [];
}

function foodEntries(snapshot) {
  const aliasesByFood = new Map();
  for (const alias of snapshot?.aliases ?? []) {
    if (!aliasesByFood.has(alias.food_id)) aliasesByFood.set(alias.food_id, []);
    aliasesByFood.get(alias.food_id).push(alias.alias);
  }
  return catalogFoods(snapshot)
    .filter(food => food.canonical_name && (!food.approval_status || food.approval_status === 'approved'))
    .map(food => ({ food, aliases: aliasesByFood.get(food.id) ?? [] }));
}

function rankCandidate(query, candidate) {
  const name = sanitizeFoodName(candidate);
  if (!name) return null;
  if (name === query) return { kind: 'exact', score: 1 };
  if (name.startsWith(query)) return { kind: 'prefix', score: 0.95 };
  if (name.split(' ').some(word => word.startsWith(query))) return { kind: 'word', score: 0.88 };
  if (query.length >= 4) {
    const score = fuzzyFoodScore(query, candidate);
    if (score >= FUZZY_SUGGEST) return { kind: 'fuzzy', score };
  }
  return null;
}

export function searchFoods(query, snapshot, limit = 8) {
  const q = sanitizeFoodName(query);
  if (q.length < 2) return [];
  const results = [];
  for (const { food, aliases } of foodEntries(snapshot)) {
    let best = null;
    for (const candidate of [food.canonical_name, ...aliases]) {
      const ranked = rankCandidate(q, candidate);
      if (!ranked) continue;
      const isAlias = candidate !== food.canonical_name;
      const adjusted = { ...ranked, score: ranked.score - (isAlias ? 0.01 : 0), matchedAlias: isAlias ? candidate : '' };
      if (!best || adjusted.score > best.score) best = adjusted;
    }
    if (best) {
      results.push({ id: food.id, label: food.canonical_name, matchedAlias: best.matchedAlias, kind: best.kind, score: best.score });
    }
  }
  return results
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, limit);
}

// Returns the closest catalog food when the typed name is not an exact name/alias.
export function findSimilarFood(name, snapshot) {
  const q = sanitizeFoodName(name);
  if (q.length < 3) return null;
  let best = null;
  for (const { food, aliases } of foodEntries(snapshot)) {
    for (const candidate of [food.canonical_name, ...aliases]) {
      if (sanitizeFoodName(candidate) === q) return null;
      const score = fuzzyFoodScore(q, candidate);
      if (score >= FUZZY_SIMILAR && (!best || score > best.score)) best = { id: food.id, label: food.canonical_name, score };
    }
  }
  return best;
}
