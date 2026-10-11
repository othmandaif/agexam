import { describe, expect, it } from "vitest";
import { clampPage, parsePageParams } from "./pagination";

describe("pagination", () => {
  it("lit page et taille, avec valeurs par défaut sûres", () => {
    expect(parsePageParams({})).toEqual({ page: 1, size: 20, offset: 0 });
    expect(parsePageParams({ page: "3", taille: "50" })).toEqual({
      page: 3,
      size: 50,
      offset: 100,
    });
    expect(parsePageParams({ page: "-2", taille: "7" })).toEqual({ page: 1, size: 20, offset: 0 });
  });
  it("ramène une page trop grande à la dernière", () => {
    expect(clampPage({ page: 9, size: 10, offset: 80 }, 25)).toEqual({
      page: 3,
      size: 10,
      offset: 20,
    });
    expect(clampPage({ page: 2, size: 10, offset: 10 }, 0)).toEqual({
      page: 1,
      size: 10,
      offset: 0,
    });
  });
});
