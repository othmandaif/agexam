import "server-only";
import { cleanText, deepseekConfigured, deepseekJson, jsonObjectOf } from "@/server/deepseek";

/**
 * Aide du « coach » pendant l'entraînement : explique ce qui ne va pas et
 * donne une piste, SANS jamais donner la solution.
 */
const SYSTEM = `Tu es un coach d'algorithmique bienveillant (pseudo-code AGSyntax, formation OFPPT).
Un étudiant s'entraîne : son algorithme ne passe pas tous les jeux d'essai. Aide-le à progresser
SANS JAMAIS lui donner la solution ni écrire le code corrigé.

AGSyntax : ALGORITHME / VARIABLES / DEBUT / FIN, « <- », LIRE(x), ECRIRE(...),
SI … ALORS … SINON … FINSI, POUR i DE 1 A n FAIRE … FINPOUR, TANT QUE … FAIRE … FINTANTQUE,
REPETER … JUSQU'A …, types ENTIER, REEL, CHAINE, CARACTERE, BOOLEEN, opérateurs DIV MOD ET OU NON.

Méthode : comprends ce que fait réellement son code, déroule-le sur un jeu d'essai qui échoue,
trouve LA cause principale de l'écart (une seule à la fois), puis guide-le par une question ou une
piste concrète (quelle ligne regarder, quelle valeur tracer, quel cas oublié).
Interdits : écrire une ligne de code corrigée, recopier le corrigé, donner la réponse finale.
Ton : encourageant, simple, tutoiement, en français, phrases courtes.

Réponds UNIQUEMENT en JSON :
{"diagnostic": "ce qui se passe (1 à 2 phrases, en citant la ligne si utile)",
 "piste": "une piste ou une question pour trouver soi-même (1 à 2 phrases)",
 "encouragement": "une courte phrase positive sur ce qui est déjà bien"}`;

export interface Hint {
  diagnostic: string;
  piste: string;
  encouragement: string;
}

export async function exerciseHint(input: {
  title: string;
  statement: string;
  solution: string;
  code: string;
  failures: { inputs: string[]; expected: string; got: string; error?: string }[];
}): Promise<Hint | null> {
  if (!deepseekConfigured()) return null;
  const numbered = input.code
    .slice(0, 8_000)
    .split("\n")
    .map((l, i) => `${String(i + 1).padStart(3)} | ${l}`)
    .join("\n");
  const fails = input.failures
    .slice(0, 3)
    .map(
      (f, i) =>
        `Jeu ${i + 1} — saisies : ${f.inputs.join(" ; ") || "(aucune)"}\n  attendu : ${f.expected.slice(0, 300)}\n  obtenu  : ${f.got.slice(0, 300) || "(rien)"}${f.error ? `\n  erreur  : ${f.error}` : ""}`,
    )
    .join("\n");
  const user = [
    `EXERCICE : ${input.title}\n${input.statement}`,
    `CORRIGÉ (pour toi seulement, NE JAMAIS le montrer ni le paraphraser en code) :\n${input.solution}`,
    `CODE DE L'ÉTUDIANT :\n${numbered}`,
    `JEUX D'ESSAI ÉCHOUÉS :\n${fails || "(erreur avant exécution)"}`,
  ].join("\n\n────────\n\n");
  const data = jsonObjectOf(
    await deepseekJson(SYSTEM, user, { timeoutMs: 25_000, maxTokens: 500, temperature: 0.3 }),
  );
  return {
    diagnostic: cleanText(data.diagnostic, 400),
    piste: cleanText(data.piste, 400),
    encouragement: cleanText(data.encouragement, 200),
  };
}
