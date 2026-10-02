/**
 * Normalize food names for deterministic catalog/alias matching.
 * Keeps meaningful descriptors (e.g. "grelhado") and removes only
 * punctuation plus configured generic terms.
 */
const DEFAULT_GENERIC_TERMS = new Set([
  'alimento', 'alimentos', 'porcao', 'porcao', 'unidade', 'unidades',
  'und', 'unid', 'unid.', 'qtd', 'quantidade', 'tipo', 'opcao', 'opção'
]);

export function sanitizeFoodName(value, genericTerms = DEFAULT_GENERIC_TERMS) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[!?.,;:/\\()[\]{}'"`´^~_+=*#%$@|<>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(token => token && !genericTerms.has(token))
    .join(' ');
}

function tokenize(value) {
  return sanitizeFoodName(value).split(' ').filter(Boolean);
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      matches++;
    }
  }
  return (2 * matches) / (a.length + b.length - 2);
}

function tokenScore(a, b) {
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (!at.size || !bt.size) return 0;
  let intersection = 0;
  at.forEach(token => { if (bt.has(token)) intersection++; });
  return intersection / Math.max(at.size, bt.size);
}

export function fuzzyFoodScore(query, candidate) {
  const a = sanitizeFoodName(query);
  const b = sanitizeFoodName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return Math.max(diceCoefficient(a, b), tokenScore(a, b) * 0.96);
}

export function matchFoodName(name, catalog = [], options = {}) {
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.78;
  const normalized = sanitizeFoodName(name);

  const exact = catalog.find(item => {
    const names = [item.name, ...(item.aliases || [])];
    return names.some(candidate => sanitizeFoodName(candidate) === normalized);
  });
  if (exact) return { status: 'matched', strategy: 'exact', score: 1, item: exact };

  let best = null;
  for (const item of catalog) {
    for (const candidate of [item.name, ...(item.aliases || [])]) {
      const score = fuzzyFoodScore(name, candidate);
      if (!best || score > best.score) best = { status: 'matched', strategy: 'fuzzy', score, item };
    }
  }

  if (best && best.score >= threshold) return best;
  return { status: 'pending', strategy: 'none', score: best?.score || 0, item: null, normalized };
}
