import { describe, expect, it } from "vitest";
import {
  canEditContent,
  examDurationSec,
  examPhase,
  publishProblems,
  type PublishCheckInput,
} from "./exam-lifecycle";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 7, h, m));

describe("examPhase", () => {
  const exam = { status: "PLANIFIE" as const, opensAt: at(10), closesAt: at(12) };

  it("suit l'heure pour un examen publié", () => {
    expect(examPhase(exam, at(9))).toBe("PLANIFIE");
    expect(examPhase(exam, at(10))).toBe("OUVERT");
    expect(examPhase(exam, at(12))).toBe("FERME");
  });

  it("garde les statuts explicites", () => {
    expect(examPhase({ ...exam, status: "BROUILLON" }, at(11))).toBe("BROUILLON");
    expect(examPhase({ ...exam, status: "FERME" }, at(11))).toBe("FERME");
  });
});

describe("publishProblems", () => {
  const valid: PublishCheckInput = {
    title: "M104 Algorithmique",
    moduleId: "m",
    groupCount: 1,
    opensAt: at(10),
    closesAt: at(12),
    questionCount: 20,
    questionErrorCount: 0,
    totalDurationSec: 30 * 60,
  };

  it("accepte un examen complet", () => {
    expect(publishProblems(valid, at(8))).toEqual([]);
  });

  it("liste tous les manques", () => {
    const problems = publishProblems(
      { ...valid, title: "", moduleId: null, groupCount: 0, questionCount: 0, opensAt: null },
      at(8),
    );
    expect(problems).toHaveLength(5);
  });

  it("refuse une fenêtre trop courte ou passée", () => {
    expect(publishProblems({ ...valid, closesAt: at(10, 20) }, at(8))[0]).toMatch(/plus courte/);
    expect(publishProblems(valid, at(13))).toContain("La fermeture est déjà passée.");
    expect(publishProblems({ ...valid, closesAt: at(9) }, at(8))).toContain(
      "La fermeture doit être après l'ouverture.",
    );
  });

  it("refuse s'il reste des erreurs dans les questions", () => {
    expect(publishProblems({ ...valid, questionErrorCount: 2 }, at(8))[0]).toMatch(/2 erreur/);
  });
});

describe("canEditContent", () => {
  it("bloque le contenu dès la première tentative", () => {
    expect(canEditContent(0)).toBe(true);
    expect(canEditContent(1)).toBe(false);
  });
});

describe("durée globale", () => {
  const base = {
    title: "Contrôle",
    moduleId: "m",
    groupCount: 1,
    questionCount: 3,
    questionErrorCount: 0,
    totalDurationSec: 90,
  };
  const now = new Date("2026-10-01T08:00:00Z");
  const opensAt = new Date("2026-10-01T09:00:00Z");

  it("exige la durée globale", () => {
    const p = publishProblems(
      { ...base, opensAt, closesAt: new Date("2026-10-01T10:00:00Z"), timerMode: "GLOBAL" },
      now,
    );
    expect(p).toContain("Indiquez la durée globale de l'examen.");
  });

  it("compare la fenêtre à la durée globale, pas à la somme des questions", () => {
    const p = publishProblems(
      {
        ...base,
        opensAt,
        closesAt: new Date("2026-10-01T09:30:00Z"),
        timerMode: "GLOBAL",
        globalDurationSec: 3600,
      },
      now,
    );
    expect(p.some((x) => x.includes("plus courte"))).toBe(true);
  });

  it("examDurationSec", () => {
    expect(examDurationSec("GLOBAL", 1800, 90)).toBe(1800);
    expect(examDurationSec("PAR_QUESTION", 1800, 90)).toBe(90);
  });
});
