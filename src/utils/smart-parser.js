/**
 * Smart Parser - Detecta e normaliza padrões comuns em planos alimentares
 * Suporta variações de formato sem causar erros
 */

/**
 * Normaliza unidades para formato padrão
 */
export function normalizeUnit(unit) {
  const map = {
    // Gramas
    'g': 'g',
    'gr': 'g',
    'grama': 'g',
    'gramas': 'g',
    'grs': 'g',
    // Quilogramas (sempre converterá para gramas no parseAlternative)
    'kg': 'kg',
    'kilo': 'kg',
    'kilos': 'kg',
    'quilograma': 'kg',
    'quilogramas': 'kg',
    'quilos': 'kg',
    'quilo': 'kg',
    // Mililitros
    'ml': 'ml',
    'mililitro': 'ml',
    'mililitros': 'ml',
    'mls': 'ml',
    // Litros (sempre converterá para ml no parseAlternative)
    'l': 'l',
    'litro': 'l',
    'litros': 'l',
    'lt': 'l',
    // Unidades
    'un': 'un',
    'und': 'un',
    'unid': 'un',
    'unidade': 'un',
    'unidades': 'un',
    'uns': 'un',
    'pcs': 'un',
    'pc': 'un',
    // Fatias
    'fatia': 'fatias',
    'fatias': 'fatias',
    'fatiada': 'fatias',
    // Colheres (converter para volume/quantidade indicativa)
    'colher': 'colher',
    'colheres': 'colher',
    'col': 'colher',
    'cols': 'colher',
    'c.': 'colher',
    'c.s': 'colher', // colher de sopa
    'c.c': 'colher', // colher de chá
    'cs': 'colher',
    'cc': 'colher',
    // Xícara
    'xicara': 'xicara',
    'xícara': 'xicara',
    'xícaras': 'xicara',
    'xicaras': 'xicara',
    'xc': 'xicara',
    'xcs': 'xicara',
    // Copos
    'copo': 'copo',
    'copos': 'copo',
  };
  
  const normalized = (unit || '').trim().toLowerCase().replace(/\.+$/g, '');
  return map[normalized] || normalized;
}

/**
 * Detecta padrões "Refeição: NOME" ou "REFEIÇÃO | HORA"
 * Retorna {name, time} ou null
 */
export function detectMealPattern(line) {
  // Padrão: "Refeição: Café da manhã" ou "REFEIÇÃO | 07:00"
  const patterns = [
    // "Refeição: nome | hora"
    /^(?:refeição|café|almoço|lanche|jantar|café_matinal|café_da_manhã)[:·\-]\s*([^|]+)(?:\|\s*(.+))?$/i,
    // "# Café da manhã | 07:00" já é tratado pelo parser principal
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        name: match[1].trim(),
        time: match[2] ? match[2].trim() : '',
      };
    }
  }
  
  return null;
}

/**
 * Detecta padrões "Opção 1:", "OPÇÃO 2", "## Opção"
 * Retorna nome da opção ou null
 */
export function detectOptionPattern(line) {
  // Padrão: "Opção 1:", "OPÇÃO 1 -", "## Opção 1"
  const patterns = [
    /^(?:opção|option|alt|alternativa)[:·\-]?\s*([^:]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Detecta variações de hora (07:00, 7h, 7 horas, etc)
 */
export function normalizeTime(time) {
  if (!time) return '';
  
  const t = time.trim().toLowerCase();
  
  // Já em formato HH:MM
  if (/^\d{1,2}:\d{2}/.test(t)) return t.match(/^\d{1,2}:\d{2}/)[0];
  
  // Formato "7h" ou "7 h" ou "7 horas"
  const hourMatch = t.match(/^(\d{1,2})\s*(?:h|horas?|hrs?)/);
  if (hourMatch) {
    const hour = String(hourMatch[1]).padStart(2, '0');
    return `${hour}:00`;
  }
  
  // Formato com minutos: "7h30" ou "7 h 30"
  const timeMatch = t.match(/^(\d{1,2})\s*(?:h|:)\s*(\d{2})/);
  if (timeMatch) {
    const hour = String(timeMatch[1]).padStart(2, '0');
    const min = String(timeMatch[2]).padStart(2, '0');
    return `${hour}:${min}`;
  }
  
  return '';
}

/**
 * Detecta se uma linha parece ser um componente/alimento
 * (não é cabeçalho, não é comentário, tem quantidade ou parece ser alimento)
 */
export function couldBeFoodLine(line) {
  const trimmed = line.trim();
  
  // Ignorar linhas vazias
  if (!trimmed) return false;
  
  // Ignorar cabeçalhos
  if (trimmed.startsWith('#')) return false;
  
  // Ignorar comentários comuns
  if (/^(?:nota:|obs:|observação:|descrição:|modo|preparo|instrução)/i.test(trimmed)) return false;
  
  // Deve ter quantidade ou parecer comida
  // Quantidade: "150g", "2 un", "1/2", etc
  if (/\d+\s*(?:g|ml|un|fatia|colher|xicara|copo|kg|l|oz|lb)/i.test(trimmed)) return true;
  
  // Ou ter peso/volume/unidade mesmo sem número explícito
  if (/\b(?:g|ml|un|fatias|colher|xicara|copos?|kg|l|oz)\b/i.test(trimmed)) return true;
  
  return false;
}

/**
 * Limpa e normaliza texto extraído de PDF
 * Remove espaçamento extra, caracteres especiais problemáticos, etc
 */
export function cleanExtractedText(rawText) {
  if (!rawText) return '';
  
  return rawText
    // Normalizar quebras de linha múltiplas
    .replace(/\n\s*\n+/g, '\n')
    // Remover espaços múltiplos
    .replace(/[ \t]+/g, ' ')
    // Remover espaços antes de pontuação
    .replace(/\s+([.,!?;:])/g, '$1')
    // Normalizar travessões
    .replace(/–|—/g, '-')
    // Remover caracteres de controle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Converte "Refeição:" em "# Refeição" para compatibilidade com parser
 */
export function convertCommonPatterns(text) {
  if (!text) return '';
  
  let result = text;
  
  // Converter "Refeição: Nome | Hora" em "# Nome | Hora"
  result = result.replace(/^(?:refeição|café|almoço|lanche|jantar)[:·]\s*([^|\n]+)(?:\|\s*(.+))?/gmi, 
    (match, name, time) => {
      const t = time ? ` | ${time}` : '';
      return `# ${name}${t}`;
    });
  
  // Converter "Opção 1:" em "## Opção 1"
  result = result.replace(/^(?:opção|option|alt|alternativa)[:·]?\s*(.+?)$/gmi,
    (match, name) => `## ${name}`);
  
  return result;
}

/**
 * Detecta se texto parece ser um plano alimentar
 * Retorna confiança de 0-1
 */
export function isProbablyMealPlan(text) {
  if (!text || text.length < 20) return 0;
  
  const lower = text.toLowerCase();
  let score = 0;
  
  // Palavras-chave de plano
  const keywords = [
    'café', 'almoço', 'lanche', 'jantar', 'refeição',
    'desjejum', 'almoço', 'café da manhã',
    'frango', 'arroz', 'feijão', 'peixe', 'ovo',
  ];
  
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 0.15;
  }
  
  // Padrões de quantidade
  if (/\d+\s*(?:g|ml|un|colher|xicara|copo|kg|l)/i.test(text)) score += 0.3;
  
  // Estrutura de linhas com números
  const lineCount = text.split('\n').length;
  const linesWithNumbers = text.split('\n').filter(l => /\d/.test(l)).length;
  if (linesWithNumbers / lineCount > 0.3) score += 0.2;
  
  return Math.min(score, 1);
}
