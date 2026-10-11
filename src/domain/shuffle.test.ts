import { describe, expect, it } from "vitest";
import { cryptoRandomInt, shuffle, shuffleKeepingFixed, type RandomInt } from "./shuffle";

/** Générateur déterministe pour les tests. */
function seeded(seed = 42): RandomInt {
  let state = seed;
  return (max) => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state % max;
  };
}

describe("cryptoRandomInt", () => {
  it("reste dans l'intervalle demandé", () => {
    for (let i = 0; i < 1_000; i++) {
      const n = cryptoRandomInt(4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
    }
  });

  it("refuse une borne invalide", () => {
    expect(() => cryptoRandomInt(0)).toThrow(RangeError);
  });
});

describe("shuffle", () => {
  it("garde les mêmes éléments sans modifier l'original", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(items, seeded());
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("shuffleKeepingFixed", () => {
  it("laisse les options fixes à leur place", () => {
    const options = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "none", fixedPosition: true }];
    for (let seed = 1; seed < 50; seed++) {
      const result = shuffleKeepingFixed(options, seeded(seed));
      expect(result[3]!.id).toBe("none");
      expect(result.map((o) => o.id).sort()).toEqual(["a", "b", "c", "none"]);
    }
  });
});
