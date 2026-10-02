export const CATEGORY_LABELS = {
  protein: 'Proteína',
  carbohydrate: 'Carboidrato',
  fruit: 'Fruta',
  vegetable: 'Verdura/Legume',
  legume: 'Leguminosa',
  dairy: 'Laticínio',
  fat: 'Gordura',
  beverage: 'Bebida',
  supplement: 'Suplemento',
  condiment: 'Condimento',
  other: 'Outro',
};

const RULES = [
  ['supplement', /whey|albumina|creatina|bcaa|hipercal[óo]rico|col[áa]geno|prote[íi]na em p[óo]|leite em p[óo]|suplemento/iu],
  ['fat', /azeite|[óo]leo|castanha|nozes?|amendoim|am[êe]ndoa|manteiga|chia|linha[çc]a|coco|abacate|gergelim|pasta de/iu],
  ['beverage', /(?<![\p{L}])caf[ée](?![\p{L}])|(?<![\p{L}])ch[áa](?![\p{L}])|suco|[áa]gua|refrigerante|bebida|isot[ôo]nico|energ[ée]tico/iu],
  ['protein', /(?<![\p{L}])ovos?(?![\p{L}])|clara|frango|galinha|carne|patinho|alcatra|fil[ée] mignon|peixe|atum|til[áa]pia|bife|salm[ãa]o|merluza|ac[ée]m|presunto|peru|sardinha|camar[ãa]o|f[íi]gado|lombo|porco|lingui[çc]a|bacon|peito|coxa|sobrecoxa|tofu|hamb[úu]rguer/iu],
  ['legume', /feij[ãa]o|lentilha|gr[ãa]o[- ]de[- ]bico|ervilha|soja/iu],
  ['carbohydrate', /arroz|macarr|massa|espaguete|p[ãa]o|batata|mandioca|aipim|inhame|aveia|tapioca|cuscuz|farinha|biscoito|bolacha|torrada|granola|cereal|milho|wrap|pur[êe]|quinoa|polenta|panqueca|bolo|barra de cereal|farelo/iu],
  ['dairy', /leite|iogurte|queijo|requeij[ãa]o|mussarela|muçarela|ricota|cottage|coalhada|kefir|creme de leite|cream cheese|nata/iu],
  ['fruit', /banana|ma[çc][ãa]|mam[ãa]o|laranja|uva|morango|manga|abacaxi|melancia|mel[ãa]o|pera|kiwi|lim[ãa]o|tangerina|mexerica|goiaba|p[êe]ssego|ameixa|a[çc]a[íi]|fruta|mirtilo|framboesa|caju|maracuj[áa]|caqui|figo/iu],
  ['vegetable', /alface|tomate|cenoura|br[óo]colis|couve|abobrinha|pepino|espinafre|beterraba|chuchu|salada|legumes?|verduras?|r[úu]cula|repolho|vagem|ab[óo]bora|cebola|pimenta[ov]|berinjela|agri[ãa]o|acelga|couve-flor/iu],
  ['condiment', /a[çc][úu]car|(?<![\p{L}])sal(?![\p{L}])|(?<![\p{L}])mel(?![\p{L}])|molho|vinagre|tempero|ketchup|mostarda|ado[çc]ante|canela|cacau|chocolate|geleia|doce de|maionese/iu],
];

export function classifyFood(name) {
  const text = String(name ?? '');
  for (const [category, pattern] of RULES) if (pattern.test(text)) return category;
  return 'other';
}

const PREPARATIONS = [
  'grelhado', 'grelhada', 'mexido', 'mexidos', 'mexida', 'cozido', 'cozida', 'cozidos', 'cozidas', 'assado', 'assada',
  'frito', 'frita', 'refogado', 'refogada', 'picado', 'picada', 'ralado', 'ralada', 'desfiado', 'desfiada', 'cru', 'crua',
  'integral', 'light', 'desnatado', 'desnatada', 'escaldado', 'poché', 'poche', 'ensopado', 'ensopada', 'moído', 'moida', 'moída',
];
const PREP_PATTERN = new RegExp(`(?<!\\p{L})(${PREPARATIONS.join('|')})(?!\\p{L})`, 'giu');
const COOKING = /grelhad|mexid|cozid|assad|frit|refogad|picad|ralad|desfiad|crua?(?![\p{L}])|escaldad|poch|ensopad|mo[íi]d/iu;

export function splitPreparation(name) {
  const text = String(name ?? '').trim();
  const found = [...text.matchAll(PREP_PATTERN)].map(match => match[0]).filter(word => COOKING.test(word));
  if (!found.length) return { food: text, preparation: '' };
  const food = text.replace(new RegExp(`\\s*(?<!\\p{L})(${found.join('|')})(?!\\p{L})`, 'giu'), '').replace(/\s{2,}/g, ' ').trim();
  return { food: food || text, preparation: found.join(' ') };
}
