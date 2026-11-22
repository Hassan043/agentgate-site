function tokens(text) {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

export function rank(records, query, source = 'all') {
  const terms = [...tokens(query)];
  if (!terms.length) return [];
  return records
    .filter(record => source === 'all' || source === record.type)
    .map((record, index) => {
      const words = tokens(record.title + ' ' + record.text);
      return { record, index, score: terms.filter(term => words.has(term)).length };
    })
    .filter(hit => hit.score === terms.length)
    .sort((a, b) => a.index - b.index)
    .slice(0, 10)
    .map(hit => hit.record);
}
