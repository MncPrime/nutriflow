import { createClient } from '@supabase/supabase-js';
import { getCatalogSnapshot, saveCatalogSnapshot } from './local-db.js';

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function loadSavedCatalog() {
  return getCatalogSnapshot();
}

export async function synchronizeCatalog() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const [foodsResult, aliasesResult] = await Promise.all([
    supabase.from('foods')
      .select('id,business_id,canonical_name,category,base_unit,purchase_unit_label,purchase_increment,cooking_factor,approval_status')
      .eq('business_id', BUSINESS_ID)
      .eq('approval_status', 'approved')
      .order('canonical_name'),
    supabase.from('food_aliases')
      .select('id,business_id,food_id,alias')
      .eq('business_id', BUSINESS_ID)
      .order('alias'),
  ]);

  const failed = [foodsResult, aliasesResult].find(result => result.error);
  if (failed) throw new Error(`Falha ao sincronizar catálogo: ${failed.error.message}`);
  if (!Array.isArray(foodsResult.data) || !Array.isArray(aliasesResult.data)) {
    throw new Error('Supabase retornou um catálogo inválido.');
  }

  const approvedIds = new Set(foodsResult.data.map(food => food.id));
  const snapshot = {
    foods: foodsResult.data,
    aliases: aliasesResult.data.filter(alias => approvedIds.has(alias.food_id)),
    config: null,
    pricesProtected: true,
    syncedAt: new Date().toISOString(),
  };
  validateCatalogSnapshot(snapshot);
  await saveCatalogSnapshot(snapshot);
  return snapshot;
}

export function validateCatalogSnapshot(snapshot) {
  const config = snapshot.config;
  if (config && !/^[A-Z]{3}$/.test(config.currency)) {
    throw new Error('Configuração inválida: informe uma moeda ISO de três letras.');
  }
  if (config) {
    const percentages = [Number(config.markup_percent), Number(config.app_fee_percent)];
    const costs = [
      Number(config.packaging_cost_per_meal),
      Number(config.labor_cost_per_meal),
      Number(config.overhead_cost_per_meal),
    ];
    if (percentages.some(value => !Number.isFinite(value) || value < 0)
      || percentages[0] + percentages[1] >= 100) {
      throw new Error('Configuração inválida: markup e taxa do app precisam somar menos de 100%.');
    }
    if (costs.some(value => !Number.isFinite(value) || value < 0)) {
      throw new Error('Configuração inválida: os custos de confecção devem ser valores não negativos.');
    }
  }
  for (const food of snapshot.foods) {
    if (!food.id || !food.canonical_name || !['g', 'ml', 'unit'].includes(food.base_unit)
      || (food.price_per_purchase_unit != null
        && (!Number.isFinite(Number(food.price_per_purchase_unit)) || Number(food.price_per_purchase_unit) < 0))
      || !Number.isFinite(Number(food.purchase_increment))
      || Number(food.purchase_increment) <= 0
      || !Number.isFinite(Number(food.cooking_factor))
      || Number(food.cooking_factor) <= 0) {
      throw new Error(`Alimento inválido recebido do catálogo: ${food.canonical_name || food.id || 'sem identificação'}.`);
    }
  }
}

export async function requestCommercialQuote(meals, state) {
  if (!supabase) {
    throw new Error('Supabase não configurado. O orçamento novo exige conexão com o servidor.');
  }
  const { data, error } = await supabase.functions.invoke('commercial-quote', {
    body: { meals, state },
  });
  if (error) {
    const status = error.context?.status;
    throw new Error(status === 403
      ? 'Origem não autorizada no servidor. Acesse o app pelo endereço oficial ou libere esta origem em CORS_ALLOWED_ORIGINS.'
      : `Falha ao calcular orçamento: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.lines) || !Array.isArray(data.meals)) {
    throw new Error('Supabase retornou um orçamento inválido.');
  }
  return data;
}

export async function submitFoodValidationRequests(foods) {
  if (!supabase) throw new Error('Supabase não configurado.');
  if (!foods.length) return;
  const rows = foods.map(food => ({
    business_id: BUSINESS_ID,
    food_name: String(food.name).trim(),
    category: food.category,
    base_unit: food.baseUnit,
    requested_quantity: Number(food.rawAmount),
  }));
  const { error } = await supabase.from('food_validation_requests').upsert(rows, {
    onConflict: 'business_id,normalized_name',
    ignoreDuplicates: true,
  });
  if (error) {
    throw new Error(`Falha ao enviar alimentos para validação: ${error.message}`);
  }
}

export async function signInAdmin(email, password) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha no login: ${error.message}`);
  if (data.user?.app_metadata?.role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('Esta conta não tem a função de administrador do NutriFlow.');
  }
  return data.user;
}

export async function requestAdminPasswordReset(email) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(`Falha ao solicitar redefinição de senha: ${error.message}`);
}

export async function updateAdminPassword(password) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(`Falha ao atualizar a senha: ${error.message}`);
  if (data.user?.app_metadata?.role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('Esta conta não tem a função de administrador do NutriFlow.');
  }
  return data.user;
}

export function subscribeToAdminPasswordRecovery(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      callback(session?.user?.app_metadata?.role === 'admin');
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function getAdminSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Falha ao verificar sessão: ${error.message}`);
  return data.session?.user?.app_metadata?.role === 'admin' ? data.session : null;
}

export async function signOutAdmin() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Falha ao encerrar sessão: ${error.message}`);
}

export async function loadAdminData() {
  if (!supabase) throw new Error('Supabase não configurado.');
  const [foodsResult, aliasesResult, configResult, requestsResult] = await Promise.all([
    supabase.from('foods').select('*').eq('business_id', BUSINESS_ID).order('canonical_name'),
    supabase.from('food_aliases').select('*').eq('business_id', BUSINESS_ID).order('alias'),
    supabase.from('business_configs').select('*').eq('business_id', BUSINESS_ID).eq('is_active', true).single(),
    supabase.from('food_validation_requests').select('*').eq('business_id', BUSINESS_ID).eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  const failed = [foodsResult, aliasesResult, configResult, requestsResult].find(result => result.error);
  if (failed) throw new Error(`Falha ao carregar painel admin: ${failed.error.message}`);
  return { foods: foodsResult.data, aliases: aliasesResult.data, config: configResult.data, requests: requestsResult.data };
}

export async function saveAdminFood(food) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const row = {
    business_id: BUSINESS_ID,
    canonical_name: food.canonical_name.trim(),
    category: food.category,
    base_unit: food.base_unit,
    purchase_unit_label: food.purchase_unit_label.trim(),
    purchase_increment: Number(food.purchase_increment),
    price_per_purchase_unit: food.price_per_purchase_unit === '' ? null : Number(food.price_per_purchase_unit),
    cooking_factor: Number(food.cooking_factor),
    approval_status: food.approval_status,
  };
  const query = food.id
    ? supabase.from('foods').update(row).eq('id', food.id).select().single()
    : supabase.from('foods').insert(row).select().single();
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao salvar alimento: ${error.message}`);
  return data;
}

export async function deleteAdminFood(id) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) throw new Error(`Falha ao excluir alimento: ${error.message}`);
}

export async function saveAdminAlias({ id, foodId, alias }) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const row = { business_id: BUSINESS_ID, food_id: foodId, alias: alias.trim() };
  const query = id
    ? supabase.from('food_aliases').update(row).eq('id', id).select().single()
    : supabase.from('food_aliases').insert(row).select().single();
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao salvar sinônimo: ${error.message}`);
  return data;
}

export async function deleteAdminAlias(id) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('food_aliases').delete().eq('id', id);
  if (error) throw new Error(`Falha ao remover sinônimo: ${error.message}`);
}

export async function resolveFoodValidationRequest(id, status, foodId = null) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('food_validation_requests')
    .update({ status, resolved_food_id: foodId, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Falha ao atualizar solicitação de alimento: ${error.message}`);
}

export async function saveAdminConfig({ id, ...values }) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const row = {
    business_id: BUSINESS_ID,
    business_name: values.business_name.trim(),
    currency: values.currency.trim().toUpperCase(),
    show_food_prices: Boolean(values.show_food_prices),
    packaging_cost_per_meal: Number(values.packaging_cost_per_meal),
    labor_cost_per_meal: Number(values.labor_cost_per_meal),
    overhead_cost_per_meal: Number(values.overhead_cost_per_meal),
    markup_percent: Number(values.markup_percent),
    app_fee_percent: Number(values.app_fee_percent),
  };
  if (row.markup_percent + row.app_fee_percent >= 100) {
    throw new Error('Markup e taxa do app devem somar menos de 100%.');
  }
  const { data, error } = await supabase
    .from('business_configs')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Falha ao salvar parâmetros comerciais: ${error.message}`);
  return data;
}
