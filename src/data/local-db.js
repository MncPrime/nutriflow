import Dexie from 'dexie';

export const localDb = new Dexie('nutriflow-commercial-offline');

localDb.version(1).stores({
  catalogSnapshots: 'id, syncedAt',
  quotes: 'id, createdAt, status',
  pendingFoods: 'normalizedName, createdAt',
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

export async function savePendingFood(food) {
  await localDb.pendingFoods.put(food);
}

export async function getPendingFoods() {
  return localDb.pendingFoods.orderBy('createdAt').reverse().toArray();
}

export async function deletePendingFood(normalizedName) {
  await localDb.pendingFoods.delete(normalizedName);
}
