import { describe, expect, it } from "vitest";
import { LESSONS } from "./__fixtures__/lessons";
import { AlgoSession, compile, normalizeOutput, runAlgorithm } from "./index";

const run = (code: string, inputs?: string[]) => runAlgorithm(code, { inputs });
const lesson = (title: string) => {
  const l = LESSONS.find((x) => x.title.startsWith(title));
  if (!l) throw new Error(`leçon introuvable : ${title}`);
  return run(l.code, l.inputs);
};

describe("toutes les leçons du tutoriel AGSyntax", () => {
  for (const l of LESSONS) {
    it(`${l.faux ? "échoue" : "s'exécute"} : ${l.title}`, () => {
      const r = run(l.code, l.inputs);
      if (l.faux) expect(r.error, r.output).not.toBeNull();
      else expect(r.error, JSON.stringify(r.error)).toBeNull();
    });
  }
});

describe("résultats exacts", () => {
  it("affectations et ECRIRE", () => {
    expect(lesson("Comment travailler").output).toBe("Le compteur vaut 10\n");
    expect(lesson("L'affectation").output).toBe("a = 26   b = 13\n");
  });

  it("AFFICHER reste sur la ligne, la saisie s'affiche en écho", () => {
    expect(lesson("ECRIRE ou AFFICHER").output).toBe(
      "Ton prenom : Yasmine\nBonjour Yasmine\n\nComptons : 1 2 3 4 5 ... termine\nLigne 1\nLigne 2\nLigne 3\n",
    );
  });

  it("constantes et réels affichés sans décimales inutiles", () => {
    expect(lesson("Les constantes").output).toContain("Montant a payer : 627\n");
    expect(lesson("LIRE : demander").output).toContain("TVA    : 30\nPrix TTC : 180\n");
  });

  it("priorités, DIV, MOD, puissance associative à droite", () => {
    expect(lesson("Les opérateurs et leurs priorités").output).toBe(
      "Sans parentheses : 20\nAvec parentheses : 15\n2 puissance 10 = 1024\n",
    );
    expect(lesson("DIV et MOD").output).toBe("7385 secondes = 2h 3min 5s\n");
    const r3 = lesson("R3").output;
    expect(r3).toContain("a / b   = 3.4");
    expect(r3).toContain("a DIV b = 3 ");
    expect(r3).toContain("a MOD b = 2 ");
    expect(r3).toContain("2 ^ 3 ^ 2     = 512");
    expect(r3).toContain("-a      = -17");
    expect(r3).toContain("a <> b   : VRAI");
    expect(r3).toContain("vrai1 ET vrai2 : FAUX");
    expect(r3).toContain("Comparaison   : VRAI");
  });

  it("conditions imbriquées et boucles", () => {
    expect(lesson("Conditions imbriquées : beaucoup").output).toContain("Bien\n");
    expect(lesson("Conditions imbriquées").output).toContain("-4 est negatif");
    expect(lesson("TANT QUE").output).toContain("Tu as saisi 3 valeurs, de somme 17");
    expect(lesson("REPETER").output).toContain("Note enregistree : 14");
    expect(lesson("Le PAS").output).toContain("5\n4\n3\n2\n1\nDecollage");
    expect(lesson("Boucles imbriquées").output).toBe("*\n**\n***\n****\n*****\n");
    expect(lesson("Compteur et accumulateur").output).toContain(
      "Moyenne : 11\nNotes >= 10 : 2 sur 4",
    );
  });

  it("tableaux, tri, matrices", () => {
    expect(lesson("Le tri à bulles").output).toBe(
      "t[1] = 1\nt[2] = 2\nt[3] = 3\nt[4] = 5\nt[5] = 7\nt[6] = 9\n",
    );
    expect(lesson("Chercher le minimum").output).toBe("Minimum : 3\nMaximum : 27 en position 3\n");
    expect(lesson("Tableaux à deux").output).toContain("Eleve 2 : moyenne 12.5");
    expect(lesson("R2").output).toContain("grille[2,3] = 23");
    expect(lesson("R6").output).toContain("Trie   : 1 2 3 3 5 7 8 9 ");
  });

  it("sous-programmes : VAR, fonctions, récursivité", () => {
    const v = lesson("Passage par valeur").output;
    expect(v).toContain("Apres passage par valeur : 21");
    expect(v).toContain("Apres passage par reference : 42");
    expect(lesson("La récursivité").output).toContain("6! = 720");
    const r7 = lesson("R7").output;
    expect(r7).toContain("Apres echange : x = 9  y = 4");
    expect(r7).toContain("2 puissance 10 = 1024");
    expect(r7).toContain("Nombres premiers jusqu a 30 : 2 3 5 7 11 13 17 19 23 29 ");
  });

  it("chaînes et fonctions prédéfinies", () => {
    expect(lesson("Manipuler du texte").output).toContain("Nombre de voyelles : 6");
    const r8 = lesson("R8").output;
    for (const s of [
      "RACINE(144)    = 12",
      "ENT(7.9)       = 7 ",
      "ARRONDI(7.9)   = 8",
      "ARRONDI(7.2)   = 7",
      "ENTIER du texte 42    = 42",
      "REEL du texte 3.5     = 3.5",
      "annee 2026",
      "LONGUEUR       = 13",
      "SOUSCHAINE 5,9 = rithmique",
      "CAR(mot, 3)    = g",
      "ASCII de A     = 65",
      "CARACTERE(66)  = B",
      "Lettre par lettre : A.l.g.o.",
    ]) {
      expect(r8).toContain(s);
    }
  });

  it("modèle complet avec saisie contrôlée", () => {
    const r = lesson("R9");
    expect(r.output).toContain("Valeur invalide, recommence.");
    expect(r.output).toContain("Moyenne          : 13");
    expect(r.output).toContain("Mention          : Assez bien");
    expect(r.inputsUsed).toBe(5);
  });
});

describe("erreurs pédagogiques", () => {
  it("variable non initialisée", () => {
    const e = lesson("La variable non initialisée").error!;
    expect(e.line).toBe(9);
    expect(e.message).toContain("« somme » est utilisée avant d'avoir reçu une valeur");
  });

  it("FINSI oublié : ligne du SI jamais refermé", () => {
    const e = lesson("Le FINSI oublié").error!;
    expect(e.kind).toBe("syntax");
    expect(e.line).toBe(9);
    expect(e.message).toContain("il manque un FINSI");
  });

  it("boucle infinie : variable jamais modifiée", () => {
    const r = lesson("La boucle infinie");
    expect(r.error!.message).toContain("i n'est jamais modifié");
    expect(r.output).toBe("");
  });

  it("boucle qui s'éloigne : arrêt après quelques tours", () => {
    const r = lesson("Une boucle qui ne s'arrête jamais");
    expect(r.error!.message).toContain("i diminue");
    expect(r.output.split("\n").length).toBeGreaterThan(4);
    expect(r.output.split("\n").length).toBeLessThan(10);
  });

  it("texte + nombre", () => {
    expect(lesson("Le mauvais type").error!.message).toContain("additionner du texte et un nombre");
  });

  it("constante modifiée : refusée avant exécution", () => {
    const code = LESSONS.find((l) => l.title === "Les constantes")!.code.replace(
      "DEBUT\n",
      "DEBUT\n  TVA <- 0.20\n",
    );
    const c = compile(code);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error.message).toContain("TVA est une constante");
  });

  it("SINONSI refusé", () => {
    const r = run(
      "DEBUT\n  SI 1 < 2 ALORS\n    ECRIRE(1)\n  SINONSI 2 < 3 ALORS\n    ECRIRE(2)\n  FINSI\nFIN",
    );
    expect(r.error!.message).toContain("SINONSI n'existe pas");
  });

  it("indice hors bornes, = au lieu de <-, OU mal formé", () => {
    expect(
      run("VARIABLES\n t : TABLEAU[1..5] DE ENTIER\nDEBUT\n t[6] <- 1\nFIN").error!.message,
    ).toContain("Indice hors bornes");
    expect(run("VARIABLES\n x : ENTIER\nDEBUT\n x = 5\nFIN").error!.message).toContain(
      "utilisez la flèche",
    );
    expect(
      run("VARIABLES\n x : ENTIER\nDEBUT\n x <- 1\n SI x = 1 OU 2 ALORS\n ECRIRE(x)\n FINSI\nFIN")
        .error!.hint,
    ).toContain("x = 1 OU x = 2");
  });

  it("saisie du mauvais type, saisie manquante", () => {
    expect(run("VARIABLES\n n : ENTIER\nDEBUT\n LIRE(n)\nFIN", ["abc"]).error!.message).toContain(
      "n'est pas un ENTIER",
    );
    expect(run("VARIABLES\n n : ENTIER\nDEBUT\n LIRE(n)\nFIN", []).error!.kind).toBe("input");
  });

  it("limite d'étapes et récursivité sans fin", () => {
    const loop = run(
      "VARIABLES\n i, j : ENTIER\nDEBUT\n i <- 0\n j <- 0\n TANT QUE i < 10 FAIRE\n  j <- j + 1\n  SI j > 1000000000 ALORS\n   i <- 10\n  FINSI\n FINTANTQUE\nFIN",
    );
    expect(loop.error!.kind).toBe("limit");
    const rec = run(
      "FONCTION F(n : ENTIER) : ENTIER\nDEBUT\n RETOURNER F(n + 1)\nFIN\nDEBUT\n ECRIRE(F(1))\nFIN",
    );
    expect(rec.error!.message).toContain("récursivité");
  });
});

describe("syntaxe souple (README AGSyntax)", () => {
  it("casse et accents libres, Tant que, Répéter… Jusqu'à, FinSi", () => {
    const code = `Algorithme Moyenne
Variables
    note1, note2, note3, moyenne : réel
Début
    Ecrire("Entrez trois notes :")
    Lire(note1, note2, note3)
    moyenne <- (note1 + note2 + note3) / 3
    Si moyenne >= 10 Alors
        Ecrire("Admis avec ", moyenne)
    Sinon
        Ecrire("Ajourné avec ", moyenne)
    FinSi
Fin`;
    const r = run(code, ["12", "14", "16"]);
    expect(r.error).toBeNull();
    expect(r.output).toContain("Admis avec 14");
  });

  it("FIN SI / FIN POUR / FIN TANT QUE en deux mots", () => {
    const r = run(`Variables
  i : entier
Debut
  Pour i De 1 A 2 Faire
    Si i = 2 Alors
      Ecrire(i)
    Fin Si
  Fin Pour
  Tant que i > 0 Faire
    i <- i - 1
  Fin Tant que
Fin`);
    expect(r.error).toBeNull();
    expect(r.output).toBe("2\n");
  });
});

describe("session interactive", () => {
  it("s'arrête sur LIRE puis reprend avec la valeur", () => {
    const s = new AlgoSession(
      'VARIABLES\n n : ENTIER\nDEBUT\n AFFICHER("n ? ")\n LIRE(n)\n ECRIRE("double : ", n * 2)\nFIN',
    );
    expect(s.advance().status).toBe("input");
    expect(s.advance("21").status).toBe("done");
    expect(normalizeOutput(s.segments.map((x) => x.text).join(""))).toBe("n ? 21\ndouble : 42");
  });
});
