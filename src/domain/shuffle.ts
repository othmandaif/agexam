/** Générateur d'entier dans [0, maxExclusive). Injectable pour les tests. */
export type RandomInt = (maxExclusive: number) => number;

const UINT32_RANGE = 2 ** 32;

/** Aléatoire cryptographique sans biais (échantillonnage par rejet). */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive invalide.");
  }
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return value % maxExclusive;
};

/** Mélange de Fisher-Yates. Ne modifie pas le tableau d'origine. */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt = cryptoRandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Mélange en gardant à leur place les éléments marqués `fixedPosition`
 * (ex. « Aucune des réponses » toujours en dernier).
 */
export function shuffleKeepingFixed<T extends { fixedPosition?: boolean }>(
  items: readonly T[],
  randomInt: RandomInt = cryptoRandomInt,
): T[] {
  const movable = shuffle(
    items.filter((item) => !item.fixedPosition),
    randomInt,
  );
  let next = 0;
  return items.map((item) => (item.fixedPosition ? item : movable[next++]!));
}
