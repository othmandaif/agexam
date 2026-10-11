import { describe, expect, it } from "vitest";
import { normalizeKey, slugify, stripAccents } from "./text";

describe("text", () => {
  it("retire les accents", () => {
    expect(stripAccents("Éléments à côté")).toBe("Elements a cote");
  });

  it("produit un slug propre", () => {
    expect(slugify("  Institut Spécialisé — Casablanca !  ")).toBe(
      "institut-specialise-casablanca",
    );
  });

  it("normalise pour comparer", () => {
    expect(normalizeKey("  Nom   Complet ")).toBe(normalizeKey("nom complet"));
    expect(normalizeKey("E-MAIL")).toBe("e-mail");
  });
});
