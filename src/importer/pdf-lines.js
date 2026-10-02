const Y_TOLERANCE = 3;

export function groupItemsIntoLines(items) {
  const rows = [];
  for (const item of items) {
    const str = String(item.str ?? '');
    if (!str.trim() || !Array.isArray(item.transform)) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const row = rows.find(candidate => Math.abs(candidate.y - y) <= Y_TOLERANCE);
    if (row) row.parts.push({ x, str });
    else rows.push({ y, parts: [{ x, str }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => row.parts.sort((a, b) => a.x - b.x).map(part => part.str.trim()).filter(Boolean).join(' '))
    .filter(Boolean);
}
