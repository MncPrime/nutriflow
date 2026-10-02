export function searchFoods(query, snapshot, limit = 8) {
  const q = String(query ?? '').trim().toLowerCase();
  if (q.length < 2 || !snapshot?.approved_foods) return [];
  return snapshot.approved_foods
    .filter(food => {
      const name = String(food.canonical_name ?? '').toLowerCase();
      return name.startsWith(q) || name.split(/\s+/).includes(q);
    })
    .slice(0, limit)
    .map(food => ({ id: food.id, label: food.canonical_name }));
}
