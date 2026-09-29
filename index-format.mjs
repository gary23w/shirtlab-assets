/** Shared by the index builder and server. Exact words, with common plural forms. */
export function words(text) {
  const result = new Set();
  for (const word of String(text).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) || []) {
    if (word.length > 64) continue;
    if (word.length > 4 && word.endsWith('ies')) result.add(word.slice(0, -3) + 'y');
    else if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) result.add(word.slice(0, -1));
    else result.add(word);
  }
  return [...result];
}
export function shard(value, count = 256) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) % count;
}
export const hex = value => value.toString(16).padStart(3, '0');
export function intersection(left, right) {
  const result = []; let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { result.push(left[i]); i++; j++; }
    else if (left[i] < right[j]) i++; else j++;
  }
  return result;
}
