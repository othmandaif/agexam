import { describe, expect, it } from "vitest";
import { unlockedLevels } from "./progress";

const ex = [
  { id: "a", level: 1 },
  { id: "b", level: 1 },
  { id: "c", level: 2 },
];

describe("unlockedLevels", () => {
  it("n'ouvre le niveau 2 que si tout le niveau 1 est réussi", () => {
    expect([...unlockedLevels(ex, new Set())]).toEqual([1]);
    expect([...unlockedLevels(ex, new Set(["a"]))]).toEqual([1]);
    expect([...unlockedLevels(ex, new Set(["a", "b"]))]).toEqual([1, 2]);
  });
});
