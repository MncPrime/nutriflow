import { createClient } from 'npm:@supabase/supabase-js@2';
import { calculateCommercialQuote } from '../../../src/domain/commercial.js';
import { toPublicQuote } from '../../../src/domain/public-quote.js';

const BUSINESS_ID = '00000000-0000-0000-0000-000000000001';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const allowedOrigins = new Set(
  (Deno.env.get('CORS_ALLOWED_ORIGINS')
    || 'https://mncprime.github.io,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

function responseHeaders(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

function validateRequest(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid quote request.');
  const request = body as { meals?: unknown; state?: unknown };
  if (!Array.isArray(request.meals) || request.meals.length > 20
    || !request.state || typeof request.state !== 'object') {
    throw new Error('Invalid quote request.');
  }
  const state = request.state as { days?: unknown; mode?: unknown; off?: unknown; moff?: unknown };
  if (typeof state.days !== 'number' || ![7, 14, 21, 28].includes(state.days)
    || (state.mode !== 'var' && state.mode !== 'eco')) {
    throw new Error('Invalid quote cycle.');
  }
  for (const meal of request.meals) {
    if (!meal || typeof meal !== 'object') throw new Error('Invalid meal data.');
    const value = meal as { name?: unknown; time?: unknown; opts?: unknown };
    if (typeof value.name !== 'string' || value.name.length > 120
      || typeof value.time !== 'string' || value.time.length > 40
      || !Array.isArray(value.opts) || value.opts.length > 20) {
      throw new Error('Invalid meal data.');
    }
    for (const option of value.opts) {
      if (!option || typeof option !== 'object') throw new Error('Invalid option data.');
      const selected = option as { name?: unknown; comps?: unknown };
      if (typeof selected.name !== 'string' || selected.name.length > 120
        || !Array.isArray(selected.comps) || selected.comps.length > 60) {
        throw new Error('Invalid option data.');
      }
      for (const component of selected.comps) {
        if (!component || typeof component !== 'object') throw new Error('Invalid component data.');
        const alternatives = (component as { alts?: unknown }).alts;
        if (!Array.isArray(alternatives) || alternatives.length > 30) {
          throw new Error('Invalid alternatives.');
        }
        for (const alternative of alternatives) {
          if (!alternative || typeof alternative !== 'object') throw new Error('Invalid food data.');
          const food = alternative as { name?: unknown; g?: unknown; ml?: unknown; n?: unknown };
          const quantities = [food.g, food.ml, food.n];
          const positiveQuantities = quantities.filter(
            (value): value is number => typeof value === 'number' && value > 0,
          );
          if (typeof food.name !== 'string' || !food.name.trim() || food.name.length > 200
            || quantities.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)
            || positiveQuantities.length !== 1) {
            throw new Error('Invalid food data.');
          }
        }
      }
    }
  }
  return {
    meals: request.meals,
    state: {
      days: state.days,
      mode: state.mode,
      off: state.off && typeof state.off === 'object' ? state.off : {},
      moff: state.moff && typeof state.moff === 'object' ? state.moff : {},
    },
  };
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const headers = responseHeaders(origin);
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers });
  }
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers });
  }
  try {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > 100_000) {
      return new Response(JSON.stringify({ error: 'Quote request is too large.' }), { status: 413, headers });
    }
    const body = JSON.parse(bodyText);
    const { meals, state } = validateRequest(body);
    const [foodsResult, aliasesResult, configResult] = await Promise.all([
      adminClient.from('foods')
        .select('id,business_id,canonical_name,category,base_unit,purchase_unit_label,purchase_increment,price_per_purchase_unit,cooking_factor,approval_status')
        .eq('business_id', BUSINESS_ID)
        .eq('approval_status', 'approved'),
      adminClient.from('food_aliases')
        .select('id,business_id,food_id,alias')
        .eq('business_id', BUSINESS_ID),
      adminClient.from('business_configs')
        .select('currency,show_food_prices,packaging_cost_per_meal,labor_cost_per_meal,overhead_cost_per_meal,markup_percent,app_fee_percent')
        .eq('business_id', BUSINESS_ID)
        .eq('is_active', true)
        .single(),
    ]);
    const failed = [foodsResult, aliasesResult, configResult].find(result => result.error);
    if (failed) {
      console.error('Commercial quote data query failed:', failed.error.message);
      return new Response(JSON.stringify({ error: 'Não foi possível calcular o orçamento agora.' }), { status: 503, headers });
    }
    const foodIds = new Set(foodsResult.data.map(food => food.id));
    const quote = calculateCommercialQuote(
      meals,
      state,
      {
        foods: foodsResult.data,
        aliases: aliasesResult.data.filter(alias => foodIds.has(alias.food_id)),
        config: configResult.data,
      },
    );
    return new Response(JSON.stringify(toPublicQuote(quote)), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid quote request.';
    const isInputError = message.startsWith('Invalid ');
    if (!isInputError) console.error('Commercial quote failed:', message);
    return new Response(
      JSON.stringify({ error: isInputError ? message : 'Não foi possível calcular o orçamento agora.' }),
      { status: isInputError ? 400 : 500, headers },
    );
  }
});
