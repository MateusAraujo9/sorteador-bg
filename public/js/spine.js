const SPINE_COUNT = 5;

export function spineIndex(category) {
  if (!category) return 0;
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return hash % SPINE_COUNT;
}
