import { describe, expect, it } from "vitest";
import { traceAlgorithm } from "./trace";

const SOMME = `ALGORITHME Somme
VARIABLES
  n, i, s : ENTIER
DEBUT
  LIRE(n)
  s <- 0
  POUR i DE 1 A n FAIRE
    s <- s + i
  FINPOUR
  ECRIRE("Somme = ", s)
FIN`;

describe("traceAlgorithm", () => {
  it("enregistre lignes, variables et explications pas à pas", () => {
    const t = traceAlgorithm(SOMME, ["3"]);
    expect(t.error).toBeNull();
    expect(t.frames.length).toBeGreaterThan(5);
    expect(t.frames[0]!.line).toBe(5);
    expect(t.frames[0]!.explain).toMatch(/lit/);
    const last = t.frames.at(-1)!;
    expect(last.explain).toBe("Fin de l'algorithme.");
    expect(last.vars.find((v) => v.name === "s")?.value).toBe("6");
    expect(last.output).toContain("Somme = 6");
    // Une variable modifiée est signalée.
    const afterRead = t.frames[1]!;
    expect(afterRead.vars.find((v) => v.name === "n")).toMatchObject({ value: "3", changed: true });
  });

  it("signale une erreur de syntaxe sans image", () => {
    const t = traceAlgorithm("DEBUT\n  x <-\nFIN", []);
    expect(t.frames).toHaveLength(0);
    expect(t.error).not.toBeNull();
  });
});

describe("explications du formateur", () => {
  it("utilise le commentaire // de la ligne", () => {
    const code = `VARIABLES
  x : ENTIER
DEBUT
  x <- 2 // on met 2 dans la case x
  ECRIRE("a // b", x)
FIN`;
    const t = traceAlgorithm(code, []);
    expect(t.error).toBeNull();
    expect(t.frames[0]!.explain).toBe("on met 2 dans la case x");
    expect(t.frames[1]!.explain).toMatch(/On affiche/);
  });
});

describe("tests SI dans l'animation", () => {
  it("indique OUI / NON après la condition et sépare l'écran des saisies", () => {
    const code = `VARIABLES
  x : ENTIER
DEBUT
  LIRE(x)
  SI x >= 10 ALORS // Admis ?
    ECRIRE("oui")
  FINSI
  SI x > 50 ALORS
    ECRIRE("grand")
  FINSI
FIN`;
    const t = traceAlgorithm(code, ["12"]);
    expect(t.frames[1]!.explain).toBe("Admis ? → OUI (vrai)");
    expect(t.frames[3]!.explain).toMatch(/→ NON \(faux\)$/);
    expect(t.frames.at(-1)!.screen).toBe("oui\n");
    expect(t.frames.at(-1)!.output).toContain("12");
  });
});
