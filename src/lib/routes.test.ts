import { describe, expect, it } from "vitest";
import { homePathFor, safeInternalPath } from "./routes";

describe("homePathFor", () => {
  it("envoie chaque rôle vers son espace", () => {
    expect(homePathFor("ETUDIANT")).toBe("/etudiant");
    expect(homePathFor("FORMATEUR")).toBe("/formateur");
    expect(homePathFor("ADMIN")).toBe("/admin");
  });
});

describe("safeInternalPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeInternalPath("/formateur/banque")).toBe("/formateur/banque");
  });

  it("refuse les redirections vers un autre site", () => {
    expect(safeInternalPath("https://exemple.com")).toBeNull();
    expect(safeInternalPath("//exemple.com")).toBeNull();
    expect(safeInternalPath("/\\exemple.com")).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });
});
