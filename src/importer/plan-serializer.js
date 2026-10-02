const formatNumber = value => String(Math.round(value * 100) / 100).replace('.', ',');
const clean = text => String(text ?? '').replace(/[\r\n#|]+/g, ' ').replace(/\s+ou\s+/giu, ' / ').replace(/\s{2,}/g, ' ').trim();

export function serializeDraft(draft) {
  const lines = [];
  const skipped = [];
  for (const meal of draft.meals) {
    const body = [];
    for (const opt of meal.opts) {
      const optionLines = [];
      for (const entry of opt.entries) {
        const parts = entry.alts.filter(alt => alt.valid && alt.quantity > 0 && clean(alt.name)).map(alt => `${formatNumber(alt.quantity)} ${alt.unit} ${clean(alt.name)}`);
        if (parts.length) optionLines.push(parts.join(' ou '));
        else skipped.push({ meal: meal.name, text: entry.alts.map(alt => alt.raw || alt.name).join(' ou ') });
      }
      if (!optionLines.length) continue;
      if (clean(opt.name)) body.push(`## ${clean(opt.name)}`);
      body.push(...optionLines);
    }
    if (!body.length) continue;
    lines.push(`# ${clean(meal.name) || 'Refeição'}${meal.time ? ` | ${clean(meal.time)}` : ''}`, ...body);
  }
  return { text: lines.join('\n'), skipped };
}
