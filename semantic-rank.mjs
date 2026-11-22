export function semanticRank(records, embeddings, query, source = 'all') {
  if (query.length !== 384 || !query.every(Number.isFinite)) throw new Error('Invalid query embedding');
  const vectors = new Map(embeddings.map(row => [row.key, row.vector]));
  return records.filter(record => source === 'all' || record.type === source)
    .map(record => {
      const vector = vectors.get(record.key);
      if (!vector || vector.length !== query.length || !vector.every(Number.isFinite)) {
        throw new Error('Archive embedding mismatch');
      }
      const product = query.reduce((sum, value, index) => sum + value * vector[index], 0);
      const magnitude = Math.hypot(...query) * Math.hypot(...vector);
      if (!magnitude) throw new Error('Empty embedding');
      return { ...record, score: product / magnitude };
    })
    .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key, 'en'))
    .slice(0, 10);
}
