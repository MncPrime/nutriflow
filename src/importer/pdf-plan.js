const ROW_TOLERANCE = 3;
const MASS = String.raw`(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(kg|g|gr|gramas?|ml|l)\b`;
const PORTION = String.raw`(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(und\.?|unid(?:ade)?s?\.?|unidades?|un|fatias?|fatia|fil[ée]s?|peda[çc]os?)\b`;

function pageRows(items) {
  const rows = [];
  for (const item of items) {
    const text = String(item.str ?? '').trim();
    if (!text || !Array.isArray(item.transform)) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= ROW_TOLERANCE);
    if (!row) rows.push(row = { y, parts: [] });
    row.parts.push({ x, text });
  }
  return rows.sort((a, b) => b.y - a.y).map(row => ({
    ...row,
    parts: row.parts.sort((a, b) => a.x - b.x),
    text: row.parts.map(part => part.text).join(' '),
  }));
}

function getScheduleName(row) {
  const text = row.parts.filter(part => part.x >= 180).map(part => part.text).join(' ');
  if (/diurno\s+e\s+terra/i.test(text)) return 'Diurno e Terra';
  if (/madrugada/i.test(text)) return 'Madrugada';
  if (/noturno/i.test(text)) return 'Noturno';
  return '';
}

function getTime(text) {
  const match = text.match(/\bhora:\s*(\d{1,2}):(\d{2})\b/i);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getMealName(labels) {
  const text = labels.join(' ').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').toLowerCase();
  if (/cafe da manha/.test(text)) return 'Café da manhã';
  if (/lanche da manha/.test(text)) return 'Lanche da manhã';
  if (/lanche da tarde/.test(text)) return 'Lanche da tarde';
  if (/lanche da noite/.test(text)) return 'Lanche da noite';
  if (/\balmoco\b/.test(text)) return 'Almoço';
  if (/\bjantar\b/.test(text)) return 'Jantar';
  if (/\bceia\b/.test(text)) return 'Ceia';
  return '';
}

function canonicalMass(value, unit) {
  const normalized = unit.toLowerCase().replace(/gramas?|gr/gi, 'g');
  return `${value.replace(',', '.')} ${normalized === 'kg' ? 'kg' : normalized === 'l' ? 'l' : normalized}`;
}

function normalizeAlternative(source) {
  let text = source
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
    .replace(/^\s*(?:ou\b|[+])\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || /a\s+vontade|a\s+gosto/i.test(text)) return '';

  const masses = [...text.matchAll(new RegExp(MASS, 'giu'))];
  if (masses.length) {
    const match = masses.at(-1);
    const quantity = canonicalMass(match[1], match[2]);
    let food = '';
    const afterMass = text.slice(match.index + match[0].length);
    if (/^\s*[-–]\s*/.test(afterMass)) {
      food = afterMass.replace(/^\s*[-–]\s*/, '');
    } else {
      const afterLastDash = text.lastIndexOf('-');
      if (afterLastDash > match.index) {
        food = text.slice(afterLastDash + 1);
      } else {
        const withoutMass = text.replace(match[0], ' ').replace(/[()[\]]/g, ' ');
        const sugar = withoutMass.match(/\bde\s+(a[çc][uú]car)\s*$/iu);
        if (sugar) {
          food = sugar[1];
        } else {
          food = withoutMass
            .replace(/^\s*\d+\/\d+\s*/u, ' ')
            .replace(/^\s*\d+(?:[.,]\d+)?\s*(?:(?:und?\.?|unidade|unidades|fatias?|fatia)(?:\s+(?:m[eé]d\.?|m[eé]dio|m[eé]dia|peq\.?|pequeno|pequena|grande))?|col(?:her(?:es)?)?\.?(?:\s+de\s+(?:sobremesa|sopa|ch[aá]))?(?:\s+cheia)?|dose|x[ií]cara)\s*/iu, ' ')
            .replace(/\b(?:m[eé]d\.?|m[eé]dio|m[eé]dia|peq\.?|pequeno|pequena|grande|cheia)\b/giu, ' ')
            .replace(/\bcol(?:her(?:es)?)(?:\s+de\s+\w+)*\b\.?/giu, ' ')
            .replace(/\b(?:com|de)\s*$/iu, ' ');
        }
      }
    }
    food = cleanFood(food);
    return food ? `${quantity} ${food}` : '';
  }

  const dash = text.lastIndexOf('-');
  let food = dash >= 0 ? text.slice(dash + 1) : text;
  const portion = text.match(new RegExp(`^\\s*${PORTION}(?:\\s+.*?\\s+-\\s+|\\s+)(.*)$`, 'iu'));
  if (portion) {
    const unit = /fatia/i.test(portion[2]) ? 'fatias' : 'un';
    const amount = `${portion[1].replace(',', '.')} ${unit}`;
    food = dash >= 0 ? text.slice(dash + 1) : portion[3];
    food = cleanFood(food);
    return food ? `${amount} ${food}` : '';
  }
  const count = text.match(/^\s*(\d+(?:[.,]\d+)?|\d+\/\d+)\s+(.+)$/u);
  if (count) {
    const amount = `${count[1].replace(',', '.')} un`;
    food = dash >= 0 ? text.slice(dash + 1) : count[2];
    food = cleanFood(food);
    return food ? `${amount} ${food}` : '';
  }
  return cleanFood(text);
}

function cleanFood(value) {
  return String(value)
    .replace(/^\s*(?:de|ou|[-–:,])+\s*/iu, '')
    .replace(/\bcozid\s+o\b/giu, 'cozido')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim();
}

function normalizeFoodLine(source) {
  const text = source.replace(/^\s*\+\s*/, '').trim();
  const alternatives = text.split(/\s+ou\s+/iu).map(normalizeAlternative).filter(Boolean);
  return alternatives.join(' ou ');
}

function normalizeFoodComponents(source) {
  const text = source.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ').replace(/^\s*\+\s*/, '').trim();
  const sugar = text.match(/^\s*1\s+x[ií]cara(?:\s+de)?\s+caf[eé].*?(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?)\s*\)?\s+de\s+a[çc][uú]car\s*$/iu);
  if (sugar) return ['1 un café', `${canonicalMass(sugar[1], sugar[2])} açúcar`];
  const line = normalizeFoodLine(source);
  return line ? [line] : [];
}

function extractVegetableChoices(source) {
  return source
    .replace(/^.*?op[cç][oõ]es?\s+de\s+legumes?\s*:\s*/iu, '')
    .replace(/[.…]+$/u, '')
    .split(',')
    .map(item => cleanFood(item))
    .filter(Boolean);
}

function normalizeMealBody(lines) {
  const output = [];
  const entries = [];
  let optionNumber = 0;
  let pending = '';
  let vegetableQuantity = '';
  let vegetableChoices = [];

  const flushPending = () => {
    if (!pending) return;
    entries.push(...normalizeFoodComponents(pending));
    pending = '';
  };
  const flushVegetables = () => {
    if (!vegetableQuantity || !vegetableChoices.length) return;
    entries.push(`${vegetableQuantity} ${vegetableChoices.join(' ou ')}`);
    vegetableQuantity = '';
    vegetableChoices = [];
  };
  const flushOption = () => {
    flushPending();
    flushVegetables();
    if (!entries.length) return;
    output.push(optionNumber ? `## Opção ${optionNumber}` : '');
    output.push(...entries);
    entries.length = 0;
  };

  for (const raw of lines) {
    const line = raw.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const option = line.match(/^op[cç][aã]o\s*(\d+)\s*:?$/iu);
    if (option) {
      flushOption();
      optionNumber = Number(option[1]);
      continue;
    }
    if (/^\(?\s*\d+(?:[.,]\d+)?\s*(?:g|gr|gramas?)\s*\)?\s*[-–].*legumes?\s+e\s+verduras?.*cozid/iu.test(line)) {
      flushPending();
      flushVegetables();
      const mass = line.match(new RegExp(MASS, 'iu'));
      vegetableQuantity = mass ? canonicalMass(mass[1], mass[2]) : '';
      continue;
    }
    if (/op[cç][oõ]es?\s+de\s+legumes?\s*:/iu.test(line)) {
      flushPending();
      vegetableChoices.push(...extractVegetableChoices(line));
      continue;
    }
    if (vegetableQuantity && !/^\d/.test(line) && !/^ou\b/iu.test(line)) {
      vegetableChoices.push(...line.split(',').map(cleanFood).filter(Boolean));
      continue;
    }
    flushVegetables();
    if (/^(?:a\s+vontade|salada\s+crua)/iu.test(line)) continue;

    const stripped = line.replace(/^\s*ou\s+/iu, '').trim();
    if (/^(?:grelhado|grelhada|cozido|cozida|assado|assada)\s*$/iu.test(stripped) && pending) {
      pending = `${pending.replace(/\s+ou\s*$/iu, '')} ${stripped}`;
      continue;
    }
    if (/^ou\b/iu.test(line) && pending) {
      pending = `${pending.replace(/\s+ou\s*$/iu, '')} ou ${stripped}`;
    } else if (/\bou\s*$/iu.test(pending)) {
      pending = `${pending.replace(/\s+ou\s*$/iu, '')} ou ${stripped}`;
    } else {
      flushPending();
      pending = line;
    }
  }
  flushOption();
  return output.filter(Boolean).join('\n');
}

function finishSection(section, schedules) {
  if (!section) return;
  const mealName = getMealName(section.labels);
  if (!mealName) return;
  const body = normalizeMealBody(section.body);
  if (!body) return;
  const schedule = schedules.find(item => item.name === section.schedule);
  if (!schedule) return;
  schedule.text += `${schedule.text ? '\n' : ''}# ${mealName} | ${section.time}\n${body}`;
}

export function extractPlanSchedules(pages) {
  const schedules = [];
  let activeSchedule = '';
  let section = null;
  const finish = () => {
    finishSection(section, schedules);
    section = null;
  };

  for (const page of pages) {
    const rows = pageRows(page.items || []);
    const hasPlanRows = rows.some(row => getTime(row.text) || getScheduleName(row));
    if (!hasPlanRows && !section) continue;
    if (!hasPlanRows && section && !rows.some(row => /op[cç][oõ]es?\s+de\s+legumes?/iu.test(row.text))) {
      finish();
      activeSchedule = '';
      continue;
    }

    for (const row of rows) {
      const scheduleName = getScheduleName(row);
      if (scheduleName) {
        finish();
        activeSchedule = scheduleName;
        if (!schedules.some(item => item.name === scheduleName)) schedules.push({ name: scheduleName, text: '' });
        continue;
      }
      const time = getTime(row.text);
      if (time) {
        finish();
        if (activeSchedule) section = { schedule: activeSchedule, time, labels: [], body: [] };
        continue;
      }
      if (!section) continue;
      const labels = row.parts.filter(part => part.x < 120).map(part => part.text);
      section.labels.push(...labels);
      const body = row.parts.filter(part => part.x >= 120).map(part => part.text).join(' ').trim();
      if (body && !/^hora\s*:/iu.test(body) && !/^(?:diurno\s+e\s+terra|madrugada|noturno)\b/iu.test(body)) section.body.push(body);
    }
  }
  finish();
  return schedules.filter(item => item.text.trim());
}
