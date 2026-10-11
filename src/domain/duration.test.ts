import { describe, expect, it } from "vitest";
import { formatDuration, formatTotalDuration, isDurationInRange, parseDuration } from "./duration";

describe("parseDuration", () => {
  it.each([
    ["30", 30],
    ["30s", 30],
    ["45 sec", 45],
    ["1min", 60],
    ["1 min 30", 90],
    ["1min30", 90],
    ["1m30s", 90],
    ["1:30", 90],
    ["2 minutes", 120],
    ["1,5min", 90],
    ["1h", 3600],
    ["  20 secondes ", 20],
  ])("lit « %s »", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "abc", "1:75", "min", "30 jours"])("refuse « %s »", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("produit un format relisible par parseDuration", () => {
    for (const sec of [5, 30, 60, 90, 125, 600, 1800]) {
      expect(parseDuration(formatDuration(sec))).toBe(sec);
    }
    expect(formatDuration(90)).toBe("1min30");
    expect(formatDuration(125)).toBe("2min05");
  });
});

describe("formatTotalDuration et bornes", () => {
  it("formate une durée totale", () => {
    expect(formatTotalDuration(3150)).toBe("52 min 30 s");
    expect(formatTotalDuration(3600)).toBe("1 h");
    expect(formatTotalDuration(0)).toBe("0 s");
  });

  it("vérifie les bornes", () => {
    expect(isDurationInRange(4)).toBe(false);
    expect(isDurationInRange(5)).toBe(true);
    expect(isDurationInRange(1801)).toBe(false);
  });
});
