import Dexie from 'dexie';

export const localDb = new Dexie('nutriflow-commercial-offline');

localDb.on('blocked',()=>console.warn('Atualização do banco local bloqueada por outra aba aberta do NutriFlow.'));

localDb.version(1).stores({
  catalogSnapshots: 'id, syncedAt',
  quotes: 'id, createdAt, status',
  pendingFoods: 'normalizedName, createdAt',
});

localDb.version(2).stores({
  catalogSnapshots: 'id, syncedAt',
  quotes: 'id, createdAt, status, requestKey',
  pendingFoods: 'normalizedName, createdAt',
});

localDb.version(3).stores({
  catalogSnapshots: 'id, syncedAt',
  quotes: 'id, createdAt, status, requestKey',
  pendingFoods: 'normalizedName, createdAt',
}).upgrade(async transaction => {
  await transaction.table('catalogSnapshots').toCollection().modify(snapshot => {
    snapshot.foods = (snapshot.foods ?? []).map(food => {
      const { price_per_purchase_unit, ...publicFood } = food;
      return publicFood;
    });
    snapshot.config = null;
    snapshot.pricesProtected = true;
  });
  await transaction.table('quotes').toCollection().modify(snapshot => {
    snapshot.lines = (snapshot.lines ?? []).map(line => {
      const { foodId, unitPrice, cost, purchaseCost, ...publicLine } = line;
      return { ...publicLine, showUnitPrice: false };
    });
    delete snapshot.totalPurchaseCost;
    snapshot.configSnapshot = {
      currency: snapshot.configSnapshot?.currency ?? 'BRL',
      show_food_prices: false,
    };
  });
});

export async function getCatalogSnapshot() {
  return (await localDb.catalogSnapshots.get('active')) ?? null;
}

export async function saveCatalogSnapshot(snapshot) {
  await localDb.catalogSnapshots.put({ ...snapshot, id: 'active' });
}

export async function saveQuoteSnapshot(snapshot) {
  await localDb.quotes.add(snapshot);
  return snapshot;
}

export async function getQuoteSnapshots() {
  return localDb.quotes.orderBy('createdAt').reverse().toArray();
}

export async function getCachedQuoteSnapshot(requestKey) {
  const matches = await localDb.quotes.where('requestKey').equals(requestKey).toArray();
  return matches.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export async function savePendingFood(food) {
  await localDb.pendingFoods.put(food);
}

export async function getPendingFoods() {
  return localDb.pendingFoods.orderBy('createdAt').reverse().toArray();
}

export async function deletePendingFood(normalizedName) {
  await localDb.pendingFoods.delete(normalizedName);
}
