import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/server/env", () => ({ serverEnv: () => ({}) }));
vi.mock("@/server/db/client", () => ({ getDb: () => null }));

const { parseReview, gradeCode } = await import("./algo-grader");

describe("parseReview", () => {
  it("lit verdict, critères et analyse", () => {
    const r = parseReview(
      JSON.stringify({
        attendus: "Lire n, afficher pair ou impair.",
        comprehension: "Lit n et l'affiche sans test.",
        execution: "Pour 7 affiche 7 au lieu de 7 est impair.",
        erreurs: [{ gravite: "manquante", description: "Aucune condition sur n MOD 2." }],
        verdict: "Insuffisant",
        criteres: [
          { cle: "structure", points: 0.1, justification: "ok" },
          { cle: "declarations", points: 0.15, justification: "ok" },
          { cle: "entrees", points: 0.15, justification: "ok" },
          { cle: "traitement", points: 0, justification: "absent" },
          { cle: "sortie", points: 0.05, justification: "valeur seule" },
        ],
        commentaire: "Bon début.",
      }),
    );
    expect(r.verdict).toBe("insuffisant");
    expect(r.score).toBe(0.45);
    expect(r.analysis).toContain("Erreurs : [manquante]");
  });
});

describe("gradeCode sans relecture", () => {
  const input = {
    prompt: "pair ou impair",
    solution: `VARIABLES\nn : ENTIER\nDEBUT\nLIRE(n)\nSI n MOD 2 = 0 ALORS\nECRIRE(n, " est pair")\nSINON\nECRIRE(n, " est impair")\nFINSI\nFIN`,
    tests: [
      { inputs: ["7"], expected: "7 est impair" },
      { inputs: ["4"], expected: "4 est pair" },
    ],
    points: 5,
  };
  it("ECRIRE(n) seul : pas la note pleine", async () => {
    const g = await gradeCode({
      ...input,
      code: "VARIABLES\nn : ENTIER\nDEBUT\nLIRE(n)\nECRIRE(n)\nFIN",
    });
    expect(g.testsPassed).toBe(0);
    expect(g.ratio).toBeLessThan(0.8);
  });
  it("algorithme juste : note pleine", async () => {
    const g = await gradeCode({ ...input, code: input.solution.replace(" est pair", " pair") });
    expect(g.testsPassed).toBe(2);
    expect(g.ratio).toBe(1);
  });
});
