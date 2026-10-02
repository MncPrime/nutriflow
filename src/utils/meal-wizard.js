/**
 * Meal Wizard - Funções para interface intuitiva de inserção de plano
 * Bottom sheet com autocomplete e sugestões
 */

export function searchFoods(query, catalogSnapshot) {
  if (!query || !catalogSnapshot?.approved_foods) return [];
  
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return catalogSnapshot.approved_foods
    .filter(food => {
      const name = food.canonical_name.toLowerCase();
      // Busca por início ou qualquer palavra do nome
      return name.startsWith(q) || name.includes(` ${q}`);
    })
    .slice(0, 8) // Limitar a 8 sugestões
    .map(food => ({
      id: food.id,
      label: food.canonical_name,
      category: food.category,
      baseUnit: food.base_unit,
    }));
}

export function getMealSuggestions(currentMeals) {
  if (!currentMeals || currentMeals.length === 0) return [];
  
  return currentMeals
    .map(meal => ({
      value: meal.name,
      label: meal.name,
      time: meal.time || '',
    }))
    .filter((meal, idx, arr) => arr.findIndex(m => m.value === meal.value) === idx); // Deduplicate
}

/**
 * Normaliza entrada de quantidade com suporte a frações
 * "1/2" → 0.5, "150,5" → 150.5
 */
export function normalizeQuantity(value) {
  if (!value) return 0;
  
  const str = String(value).trim().replace(/\s+/g, '');
  
  // Suportar frações
  if (str.includes('/')) {
    const [num, den] = str.split('/').map(x => Number(x.replace(',', '.')));
    if (den && num) return num / den;
  }
  
  // Suportar vírgula ou ponto decimal
  return Number(str.replace(',', '.'));
}

/**
 * Valida quantidade e retorna feedback
 */
export function validateQuantity(qty, unit) {
  const normalized = normalizeQuantity(qty);
  
  if (normalized <= 0) return { valid: false, message: 'Quantidade deve ser maior que zero' };
  if (normalized > 10000) return { valid: false, message: 'Quantidade parece muito alta' };
  
  return { valid: true, message: '' };
}

/**
 * Formata quantidade para string de alimentoo
 * 150 + g → "150 g alimento"
 */
export function formatFoodLine(quantity, unit, foodName) {
  if (!foodName || quantity <= 0) return '';
  
  const qty = normalizeQuantity(quantity);
  const unitLabel = {
    g: 'g',
    ml: 'ml',
    un: 'un',
    fatias: 'fatias',
  }[unit] || unit;
  
  return `${qty} ${unitLabel} ${foodName}`;
}

/**
 * Detecta unidade padrão para um alimento baseado no catálogo
 */
export function suggestUnit(food) {
  if (!food?.baseUnit) return 'g';
  
  const unitMap = {
    'g': 'g',
    'ml': 'ml',
    'un': 'un',
    'unidade': 'un',
    'unidades': 'un',
    'fatias': 'fatias',
  };
  
  return unitMap[food.baseUnit?.toLowerCase()] || 'g';
}

/**
 * Valida se o nome do alimento está no catálogo
 */
export function validateFoodExists(foodName, catalogSnapshot) {
  if (!foodName || !catalogSnapshot?.approved_foods) return false;
  
  const q = foodName.trim().toLowerCase();
  return catalogSnapshot.approved_foods.some(
    food => food.canonical_name.toLowerCase() === q
  );
}

/**
 * Encontra sugestão exata de alimento no catálogo
 */
export function findFoodSuggestion(foodName, catalogSnapshot) {
  if (!foodName || !catalogSnapshot?.approved_foods) return null;
  
  const q = foodName.trim().toLowerCase();
  
  // Busca exata
  let food = catalogSnapshot.approved_foods.find(
    f => f.canonical_name.toLowerCase() === q
  );
  
  if (food) return food;
  
  // Busca parcial (primeira palavra)
  const words = q.split(/\s+/);
  if (words.length > 1) {
    food = catalogSnapshot.approved_foods.find(
      f => f.canonical_name.toLowerCase().startsWith(words[0])
    );
  }
  
  return food;
}
