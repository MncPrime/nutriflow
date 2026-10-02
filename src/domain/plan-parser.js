const unitAliases = {
  g: 'g', gr: 'g', grama: 'g', gramas: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml', l: 'l', litro: 'l', litros: 'l',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', fatia: 'fatias', fatias: 'fatias',
};

const numberFrom = value => {
  const normalized = value.replace(',', '.');
  if (!normalized.includes('/')) return Number.parseFloat(normalized);
  const [numerator, denominator] = normalized.split('/').map(Number);
  return numerator / denominator;
};

function parseAlternative(part, previous, categoryForName) {
  const match = part.trim().match(/^(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/u);
  if (!match) {
    return previous
      ? { value: { name: part.trim(), g: previous.g, ml: previous.ml || 0, n: previous.n, cat: categoryForName(part) } }
      : { warning: `Não foi possível identificar quantidade e unidade em “${part.trim()}”.` };
  }
  let quantity = numberFrom(match[1]);
  const rest = match[2].trim();
  let unit = 'un';
  let name = rest;
  const unitAndName = rest.match(/^([\p{L}.]+)\s+(.+)$/iu);
  if (unitAndName) {
    const candidate = unitAndName[1].replace('.', '').toLowerCase();
    if (unitAliases[candidate]) {
      unit = unitAliases[candidate];
      name = unitAndName[2].trim();
    } else if (/^(colher|colheres|xicara|xícara|copos?)$/i.test(candidate)) {
      return { warning: `A unidade “${unitAndName[1]}” de “${part.trim()}” não é suportada. Use g, ml, un ou fatias.` };
    }
  }
  if (!name) return { warning: `Falta o nome do alimento após “${part.trim()}”.` };
  if (unit === 'kg') { quantity *= 1000; unit = 'g'; }
  if (unit === 'l') { quantity *= 1000; unit = 'ml'; }
  const g = unit === 'g' ? quantity : 0;
  const ml = unit === 'ml' ? quantity : 0;
  return { value: { name, g, ml, n: g || ml ? 0 : quantity, cat: categoryForName(name) } };
}

export function parsePlanText(text, categoryForName) {
  const meals = [];
  const warnings = [];
  let meal;
  let option;
  for (const [index, raw] of String(text ?? '').split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '#' && line[1] !== '#') {
      const [name, time] = line.slice(1).split('|');
      if (!name.trim()) warnings.push(`Linha ${index + 1}: informe o nome da refeição após #.`);
      else { meal = { name: name.trim(), time: (time || '').trim(), opts: [] }; meals.push(meal); option = null; }
      continue;
    }
    if (line.startsWith('##')) {
      if (!meal) warnings.push(`Linha ${index + 1}: uma opção precisa estar dentro de uma refeição.`);
      else { option = { name: line.slice(2).trim(), comps: [] }; meal.opts.push(option); }
      continue;
    }
    if (!meal) { warnings.push(`Linha ${index + 1}: crie uma refeição antes de adicionar alimentos.`); continue; }
    if (!/\d/.test(line)) { warnings.push(`Linha ${index + 1}: “${line}” ficou fora da prévia porque não tem quantidade.`); continue; }
    if (!option) { option = { name: '', comps: [] }; meal.opts.push(option); }
    let previous = null;
    const alternatives = [];
    for (const part of line.split(/\s+ou\s+/i)) {
      const result = parseAlternative(part, previous, categoryForName);
      if (result.warning) warnings.push(`Linha ${index + 1}: ${result.warning}`);
      if (result.value) { alternatives.push(result.value); previous = result.value; }
    }
    if (alternatives.length) option.comps.push({ alts: alternatives });
    else warnings.push(`Linha ${index + 1}: nenhum alimento foi reconhecido.`);
  }
  if (!meals.length) warnings.unshift('Nenhuma refeição foi encontrada. Comece com “# Nome da refeição”.');
  return { meals, warnings };
}
