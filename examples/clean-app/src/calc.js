// Clean fixture: tiny pure helpers, no planted issues.
export function add(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError('add() expects finite numbers');
  }
  return a + b;
}

export const VERSION = 1;
