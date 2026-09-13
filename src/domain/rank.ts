/** Lexicographic fractional rank. Not unique; callers sort ties by id. */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function alphabetIndex(char: string): number {
  const index = ALPHABET.indexOf(char);
  if (index < 0) throw new Error('Step order contains an unsupported character.');
  return index;
}

function randomJitter(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? '0';
}

/**
 * A key strictly between `before` and `after`. Either bound may be null.
 * Jitter is appended when it stays inside the bounds so two devices picking
 * the same midpoint do not collide. Pass `''` for a stable key in tests.
 */
export function rankBetween(
  before: string | null,
  after: string | null,
  jitter?: string,
): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error('Cannot place a step between those positions.');
  }

  const key = midpoint(before ?? '', after);
  const extra = jitter === undefined ? randomJitter() : jitter;
  if (!extra) return key;

  const candidate = key + extra;
  if (before !== null && candidate <= before) return key;
  if (after !== null && candidate >= after) return key;
  return candidate;
}

function midpoint(lo: string, hi: string | null): string {
  let prefix = '';

  for (let i = 0; i < 64; i += 1) {
    const loIndex = i < lo.length ? alphabetIndex(lo[i] ?? '') : 0;
    const hiIndex = hi !== null && i < hi.length ? alphabetIndex(hi[i] ?? '') : ALPHABET.length;
    if (hiIndex - loIndex > 1) {
      return prefix + ALPHABET[loIndex + Math.floor((hiIndex - loIndex) / 2)];
    }
    prefix += ALPHABET[loIndex];
  }

  return `${prefix}V`;
}
