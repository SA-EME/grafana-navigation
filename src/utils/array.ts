export function replaceItem<T>(arr: T[], index: number, item: T): T[] {
  return arr.map((x, i) => (i === index ? item : x));
}

export function removeItem<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

export function swapItems<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
