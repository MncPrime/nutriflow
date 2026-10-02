const QUANTITY = /\d+(?:[.,]\d+)?\s*(?:g|gr|gramas?|kg|ml|l|un|und|unidades?|fatias?)(?![\p{L}])/giu;
const MEAL = /caf[ée] da manh[ãa]|almo[çc]o|jantar|janta|lanche|ceia|colação|pr[ée]-?treino|p[óo]s-?treino|refei[çc][ãa]o/giu;

export function isLikelyPlan(text) {
  const quantities = (String(text).match(QUANTITY) || []).length;
  const meals = (String(text).match(MEAL) || []).length;
  return quantities >= 3 || (quantities >= 1 && meals >= 1);
}
