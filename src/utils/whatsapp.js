export const waBold = value => `*${value}*`;
export const waItalic = value => `_${value}_`;
export const waMono = value => `\`${value}\``;

const money = value => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export function buildWhatsAppShoppingSummary({
  title = 'NutriFlow — Lista de compras',
  sections = [],
  subtotal = 0,
  preparationFee = 0,
  deliveryText = 'Entrega: A combinar com o produtor'
} = {}) {
  const lines = [waBold(title), ''];

  for (const section of sections) {
    lines.push(waBold(section.title || 'Itens'));
    for (const item of section.items || []) {
      const quantity = item.quantity ?? '';
      const cost = money(item.cost);
      lines.push(`• ${item.name} — ${waMono(quantity)} — ${cost}`);
    }
    if (section.subtotal != null) {
      lines.push(`${waItalic('Subtotal')}: ${waBold(money(section.subtotal))}`);
    }
    lines.push('');
  }

  lines.push(`${waItalic('Subtotal dos alimentos')}: ${waBold(money(subtotal))}`);
  lines.push(`${waItalic('Taxa de confecção')}: ${waBold(money(preparationFee))}`);
  lines.push(`${waBold('Total')}: ${waBold(money(Number(subtotal) + Number(preparationFee)))}`);
  lines.push('');
  lines.push(deliveryText);

  return lines.join('\n').trim();
}

export function buildWhatsAppUrl(text, phone = '') {
  const encoded = encodeURIComponent(text);
  return phone ? `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
