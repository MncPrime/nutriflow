import { classifyFood, splitPreparation } from './food-classifier.js';

export const SUPPORTED_UNITS = ['g', 'ml', 'un', 'fatias'];

const UNIT_ALIASES = {
  g: 'g', gr: 'g', grama: 'g', gramas: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml', l: 'l', litro: 'l', litros: 'l',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un',
  fatia: 'fatias', fatias: 'fatias',
  filé: 'un', file: 'un', filés: 'un', pedaço: 'un', pedacos: 'un', pedaços: 'un', posta: 'un', postas: 'un',
};
const UNSUPPORTED_UNITS = /^(colher|colheres|c\.?s\.?|xicara|xícara|xicaras|xícaras|copo|copos|concha|conchas|porcao|porção|porções|scoop|dose)$/iu;

const NUM = String.raw`(\d+\/\d+|\d+(?:[.,]\d+)?)`;
const MEAL_NAME = /^(caf[ée] da manh[ãa]|desjejum|caf[ée]|lanche(?: da (?:manh[ãa]|tarde|noite))?|colação|colacao|almo[çc]o|jantar|janta|ceia|pr[ée][- ]?treino|p[óo]s[- ]?treino|merenda|brunch|refei[çc][ãa]o(?: \d+)?)(?!\p{L})/iu;
const TIME = /\b(\d{1,2})\s*(?::|h)\s*(\d{2})?\b/u;
const NOTE = /^(obs(?:erva[çc][ãa]o|\.)?|nota|aten[çc][ãa]o|importante)\s*[:\-]/iu;
const NOISE = /^(p[áa]gina\s+\d+(\s+de\s+\d+)?|\d+\s*\/\s*\d+|\d+)$/iu;

let counter = 0;
export const newId = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

const numberFrom = value => {
  const normalized = value.replace(',', '.');
  if (!normalized.includes('/')) return Number.parseFloat(normalized);
  const [n, d] = normalized.split('/').map(Number);
  return d ? n / d : NaN;
};

function normalizeUnit(raw) {
  const key = raw.replace(/\.$/, '').toLowerCase();
  if (UNIT_ALIASES[key]) return { unit: UNIT_ALIASES[key] };
  if (UNSUPPORTED_UNITS.test(key)) return { unsupported: raw };
  return null;
}

function finalizeQuantity(quantity, unit) {
  if (unit === 'kg') return { quantity: quantity * 1000, unit: 'g' };
  if (unit === 'l') return { quantity: quantity * 1000, unit: 'ml' };
  return { quantity, unit };
}

export function parseAlternativeText(text, previous) {
  const original = String(text).trim();
  const alt = { id: newId(), name: '', food: '', preparation: '', quantity: null, unit: 'un', unsupportedUnit: '', inherited: false, estimated: false, raw: original };
  let rest = original;
  const lead = rest.match(new RegExp(`^${NUM}\\s*(.*)$`, 'u'));
  if (lead) {
    let quantity = numberFrom(lead[1]);
    rest = lead[2].trim();
    let unit = 'un';
    const candidate = rest.match(/^([\p{L}.]+)(?:\s+(.*))?$/u);
    if (candidate) {
      const normalized = normalizeUnit(candidate[1]);
      if (normalized?.unit) { unit = normalized.unit; rest = (candidate[2] || '').trim(); }
      else if (normalized?.unsupported) { alt.unsupportedUnit = normalized.unsupported; rest = (candidate[2] || '').trim(); }
    }
    ({ quantity, unit } = finalizeQuantity(quantity, unit));
    alt.quantity = Number.isFinite(quantity) && quantity > 0 ? quantity : null;
    alt.unit = unit;
    rest = rest.replace(/^de\s+/iu, '');
  } else {
    const inner = rest.match(new RegExp(`(?:^|\\s)${NUM}\\s*(g|gr|gramas?|kg|ml|l|un|und|unidades?|fatias?)\\b\\.?`, 'iu'));
    if (inner) {
      const normalized = normalizeUnit(inner[2]);
      const converted = finalizeQuantity(numberFrom(inner[1]), normalized.unit);
      alt.quantity = converted.quantity > 0 ? converted.quantity : null;
      alt.unit = converted.unit;
      alt.estimated = true;
      rest = rest.replace(inner[0], ' ').replace(/\s{2,}/g, ' ').replace(/\s*\+\s*$/, '').trim();
    } else if (previous && previous.quantity != null) {
      alt.quantity = previous.quantity;
      alt.unit = previous.unit;
      alt.inherited = true;
    }
  }
  alt.name = rest.replace(/^[-–:,\s]+|[-–:,\s]+$/g, '');
  const { food, preparation } = splitPreparation(alt.name);
  alt.food = food;
  alt.preparation = preparation;
  alt.category = classifyFood(alt.name);
  return alt;
}

export function parseEntryText(text) {
  const line = String(text).trim();
  if (!line) return [];
  const orParts = line.split(/\s+ou\s+/iu).map(part => part.trim()).filter(Boolean);
  if (orParts.length > 1) return [parseAlternatives(orParts)];
  const plusParts = line.split(/\s*\+\s*/u).map(part => part.trim()).filter(Boolean);
  if (plusParts.length > 1 && plusParts.every(part => new RegExp(`^${NUM}`, 'u').test(part))) {
    return plusParts.map(part => ({ id: newId(), alts: [parseAlternativeText(part, null)] }));
  }
  return [{ id: newId(), alts: [parseAlternativeText(line, null)] }];
}

function parseAlternatives(parts) {
  const alts = [];
  let previous = null;
  for (const part of parts) {
    const alt = parseAlternativeText(part, previous);
    alts.push(alt);
    previous = alt;
  }
  return { id: newId(), alts };
}

function extractTime(text) {
  const match = text.match(TIME);
  if (!match) return { time: '', rest: text };
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return { time: '', rest: text };
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { time, rest: text.replace(match[0], ' ').replace(/[()\[\]]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '') };
}

function parseHeader(line) {
  if (/^#(?!#)/.test(line)) {
    const [name, time] = line.slice(1).split('|');
    return { name: name.trim(), time: (time || '').trim() };
  }
  const labeled = line.replace(/^refei[çc][ãa]o\s*:\s*/iu, '');
  const withoutBullet = labeled.replace(/^\d+[.)]\s+/, '');
  const { time, rest } = extractTime(withoutBullet.split('|')[0] && withoutBullet.includes('|') ? withoutBullet.replace('|', ' ') : withoutBullet);
  const name = rest.replace(/[:\-–]+$/u, '').trim();
  if (!name || name.length > 40 || !MEAL_NAME.test(name)) return null;
  if (new RegExp(`${NUM}\\s*(g|gr|ml|kg|un|fatias?|unidades?)\\b`, 'iu').test(name)) return null;
  return { name, time };
}

export function structurePlan(text) {
  const meals = [];
  const notes = [];
  let meal = null;
  let opt = null;
  const ensureOpt = () => {
    if (!opt) { opt = { id: newId(), name: '', entries: [] }; meal.opts.push(opt); }
    return opt;
  };
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    let line = raw.replace(/\s+/g, ' ').trim();
    if (!line || NOISE.test(line)) continue;
    line = line.replace(/^[•·*▪●○◦-]\s+/u, '');
    if (!line) continue;
    const header = parseHeader(line);
    if (header) {
      meal = { id: newId(), name: header.name || 'Refeição', time: header.time, opts: [], notes: [] };
      meals.push(meal);
      opt = null;
      continue;
    }
    if (/^##/.test(line) || /^op[çc][ãa]o\s*\d*\s*[:\-]?$/iu.test(line)) {
      if (meal) { opt = { id: newId(), name: line.replace(/^##\s*/, '').replace(/[:\-]+$/, '').trim(), entries: [] }; meal.opts.push(opt); }
      continue;
    }
    if (/^\d{1,2}\s*(?::|h)\s*(\d{2})?$/u.test(line) && meal && !meal.time) { meal.time = extractTime(line).time; continue; }
    if (NOTE.test(line) || /^\(.*\)$/.test(line)) { (meal ? meal.notes : notes).push(line.replace(NOTE, '').replace(/^\(|\)$/g, '').trim()); continue; }
    if (!meal) { notes.push(line); continue; }
    const hasQuantity = new RegExp(NUM, 'u').test(line);
    if (!hasQuantity && line.length > 70) { meal.notes.push(line); continue; }
    ensureOpt().entries.push(...parseEntryText(line));
  }
  return { meals: meals.filter(item => item.opts.some(option => option.entries.length) || item.name), notes };
}
