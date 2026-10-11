import { describe, expect, it } from "vitest";
import {
  buildQuestionText,
  EXAMPLE_QUESTION_TEXT,
  parseQuestionText,
  setCorrectAnswers,
  setFieldForAll,
  setQuestionField,
  summarize,
} from "./question-text";

const ok = (text: string) => {
  const r = parseQuestionText(text);
  const errs = [...r.globalErrors.map((e) => e.message), ...r.questions.flatMap((q) => q.errors)];
  expect(errs).toEqual([]);
  return r.questions;
};

describe("parseQuestionText — format AGExam", () => {
  it("lit une question simple avec *", () => {
    const [q] = ok(`Q: Quelle structure répète un bloc ?
A) Si … Alors
B) TantQue … Faire *
C) Pour
DUREE: 30s`);
    expect(q!.prompt).toBe("Quelle structure répète un bloc ?");
    expect(q!.options.map((o) => [o.letter, o.label, o.isCorrect])).toEqual([
      ["A", "Si … Alors", false],
      ["B", "TantQue … Faire", true],
      ["C", "Pour", false],
    ]);
    expect(q!.type).toBe("QCM_SIMPLE");
    expect(q!.multipleAnswers).toBe(false);
    expect(q!.durationSec).toBe(30);
    expect(q!.durationFromText).toBe(true);
    expect(q!.points).toBe(1);
  });

  it("détecte le QCM multiple, les points et l'explication", () => {
    const [q] = ok(`Question 2 : Quelles méthodes ajoutent à la fin ?
a. append *
b. add
c. insert(len) *
POINTS: 1,5
EXPLICATION: append et insert(len) ajoutent en fin.`);
    expect(q!.type).toBe("QCM_MULTIPLE");
    expect(q!.multipleAnswers).toBe(true);
    expect(q!.points).toBe(1.5);
    expect(q!.explanation).toBe("append et insert(len) ajoutent en fin.");
    expect(q!.durationFromText).toBe(false);
    expect(q!.durationSec).toBe(60);
  });

  it("lit un bloc de code (avec ligne vide) et propose 1min30", () => {
    const [q] = ok(`Q: Que vaut s ?
\`\`\`python
s = 0

for i in range(3):
    s += i
\`\`\`
A) 3 *
B) 6`);
    expect(q!.code).toBe("s = 0\n\nfor i in range(3):\n    s += i");
    expect(q!.codeLanguage).toBe("PYTHON");
    expect(q!.type).toBe("TRACE_ALGORITHME");
    expect(q!.durationSec).toBe(90);
  });

  it("détecte vrai / faux et propose 30 s", () => {
    const [q] = ok(`Q: L'indice commence toujours à 1.
A) Vrai
B) Faux *`);
    expect(q!.type).toBe("VRAI_FAUX");
    expect(q!.durationSec).toBe(30);
  });

  it("fixe la position de « Aucune des réponses »", () => {
    const [q] = ok(`Q: x ?
A) un *
B) deux
C) Aucune des réponses précédentes`);
    expect(q!.options.map((o) => o.fixedPosition)).toEqual([false, false, true]);
  });

  it("enchaîne plusieurs questions et numérote", () => {
    const qs = ok(`1. Première ?
A) oui *
B) non

2) Deuxième ?
A) oui
B) non *
DUREE: 1:15`);
    expect(qs.map((q) => [q.number, q.prompt, q.durationSec])).toEqual([
      [1, "Première ?", 45],
      [2, "Deuxième ?", 75],
    ]);
  });

  it("accepte un énoncé sur plusieurs lignes et une réponse sur deux lignes", () => {
    const [q] = ok(`Q: Ligne 1
ligne 2
A) réponse
   suite *
B) autre`);
    expect(q!.prompt).toBe("Ligne 1\nligne 2");
    expect(q!.options[0]!.label).toBe("réponse suite");
    expect(q!.options[0]!.isCorrect).toBe(true);
  });
});

describe("parseQuestionText — format Moodle Aiken", () => {
  it("lit ANSWER: et enchaîne sans « Q: »", () => {
    const qs = ok(`Quelle est la capitale du Maroc ?
A. Casablanca
B. Rabat
C. Fès
ANSWER: B

Combien font 2 + 2 ?
A. 3
B. 4
ANSWER: B`);
    expect(qs).toHaveLength(2);
    expect(qs[0]!.options.find((o) => o.isCorrect)!.label).toBe("Rabat");
    expect(qs[1]!.prompt).toBe("Combien font 2 + 2 ?");
  });

  it("lit RÉPONSES: A et C", () => {
    const [q] = ok(`Q: Pairs ?
A) 2
B) 3
C) 4
RÉPONSES: A et C`);
    expect(q!.options.filter((o) => o.isCorrect).map((o) => o.letter)).toEqual(["A", "C"]);
  });
});

describe("parseQuestionText — erreurs", () => {
  const errorsOf = (text: string) => parseQuestionText(text).questions.flatMap((q) => q.errors);

  it("signale l'absence de bonne réponse", () => {
    expect(errorsOf("Q: x\nA) a\nB) b")).toEqual([
      "Aucune bonne réponse : ajoutez * à la fin de la bonne réponse.",
    ]);
  });

  it("signale moins de 2 réponses et l'énoncé manquant", () => {
    expect(errorsOf("Q:\nA) seule *")).toEqual([
      "Énoncé manquant.",
      "Au moins 2 réponses sont nécessaires.",
    ]);
  });

  it("signale une durée illisible ou hors limites", () => {
    expect(errorsOf("Q: x\nA) a *\nB) b\nDUREE: bientôt")[0]).toMatch(/Durée illisible/);
    expect(errorsOf("Q: x\nA) a *\nB) b\nDUREE: 2h")[0]).toMatch(/hors limites/);
  });

  it("signale une lettre de réponse inexistante et un code non fermé", () => {
    expect(errorsOf("Q: x\nA) a\nB) b\nANSWER: D")).toContain("La réponse D n'existe pas.");
    expect(errorsOf("Q: x\n```\ncode\nA) a *\nB) b")).toContain(
      "Bloc de code non fermé : ajoutez ``` à la fin du code.",
    );
  });

  it("signale un mot-clé avant la première question", () => {
    expect(parseQuestionText("DUREE: 30s\nQ: x\nA) a *\nB) b").globalErrors).toHaveLength(1);
  });
});

describe("modification ciblée et résumé", () => {
  const text = `Q: Un ?
A) a *
B) b

Q: Deux ?
A) a
B) b *
DUREE: 1min`;

  it("ajoute ou remplace la durée sans toucher au reste", () => {
    const [q1, q2] = parseQuestionText(text).questions;
    const withQ1 = setQuestionField(text, q1!, "DUREE", "20s");
    expect(withQ1).toContain("B) b\nDUREE: 20s\n\nQ: Deux ?");
    const withQ2 = setQuestionField(text, q2!, "DUREE", "2min");
    expect(withQ2.endsWith("DUREE: 2min")).toBe(true);
    expect(parseQuestionText(withQ2).questions[1]!.durationSec).toBe(120);
  });

  it("applique une valeur à toutes les questions", () => {
    const r = parseQuestionText(text);
    const updated = setFieldForAll(text, r.questions, "DUREE", () => "40s");
    expect(parseQuestionText(updated).questions.map((q) => q.durationSec)).toEqual([40, 40]);
  });

  it("résume le texte d'exemple sans erreur", () => {
    const r = parseQuestionText(EXAMPLE_QUESTION_TEXT);
    expect(summarize(r)).toEqual({
      questionCount: 4,
      totalDurationSec: 30 + 60 + 90 + 30,
      totalPoints: 5,
      errorCount: 0,
      warningCount: 0,
    });
  });

  it("buildQuestionText produit un texte relu à l'identique", () => {
    const text2 = buildQuestionText([
      {
        prompt: "Q ?",
        options: [
          { label: "x", isCorrect: false },
          { label: "y", isCorrect: true },
        ],
        durationSec: 75,
        points: 3,
      },
    ]);
    const [q] = ok(text2);
    expect(q!.durationSec).toBe(75);
    expect(q!.points).toBe(3);
    expect(q!.options[1]!.isCorrect).toBe(true);
  });
});

describe("setCorrectAnswers", () => {
  const text = [
    "Q: Capitale du Maroc ?",
    "A) Casablanca *",
    "B) Rabat",
    "* C) Fès",
    "DUREE: 30s",
    "",
    "Q: Langages compilés ?",
    "```python",
    "réponse: x = 1",
    "```",
    "A) C",
    "B) Java",
    "C) Python",
    "RÉPONSE: A",
  ].join("\n");

  it("réécrit les « * » et garde le reste", () => {
    const { questions } = parseQuestionText(text);
    const out = setCorrectAnswers(text, questions[0]!, ["B"]);
    const again = parseQuestionText(out).questions[0]!;
    expect(again.options.map((o) => o.isCorrect)).toEqual([false, true, false]);
    expect(out).toContain("A) Casablanca\n");
    expect(out).toContain("B) Rabat *");
    expect(out).toContain("DUREE: 30s");
  });

  it("retire la ligne RÉPONSE mais pas le code", () => {
    const { questions } = parseQuestionText(text);
    const out = setCorrectAnswers(text, questions[1]!, ["A", "B"]);
    expect(out).not.toContain("RÉPONSE: A");
    expect(out).toContain("réponse: x = 1");
    const again = parseQuestionText(out).questions[1]!;
    expect(again.options.map((o) => o.isCorrect)).toEqual([true, true, false]);
    expect(again.errors).toEqual([]);
  });
});
