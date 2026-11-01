/**
 * Entraînement façon jeu : points (XP), rangs et badges, calculés à partir des
 * soumissions (rien de stocké : toujours cohérent avec l'historique).
 */

export interface ExerciseProgress {
  level: number;
  solved: boolean;
  /** Nombre de soumissions. */
  attempts: number;
  /** Réussi dès la première soumission. */
  firstTry: boolean;
}

export const xpForExercise = (level: number, firstTry: boolean) => 10 * level + (firstTry ? 5 : 0);

export const RANKS = [
  { min: 0, title: "Débutant", icon: "🌱" },
  { min: 50, title: "Apprenti", icon: "🧩" },
  { min: 150, title: "Codeur", icon: "💻" },
  { min: 300, title: "Expert", icon: "🚀" },
  { min: 600, title: "Maître de l'algo", icon: "🏆" },
] as const;

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1]!.min) i++;
  const next = RANKS[i + 1] ?? null;
  const cur = RANKS[i]!;
  return {
    ...cur,
    next,
    /** Progression vers le rang suivant (0 à 1). */
    progress: next ? (xp - cur.min) / (next.min - cur.min) : 1,
  };
}

export interface Badge {
  key: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
}

export function computeBadges(list: ExerciseProgress[]): Badge[] {
  const solved = list.filter((e) => e.solved);
  const firstTry = solved.filter((e) => e.firstTry).length;
  const levels = [...new Set(list.map((e) => e.level))];
  const fullLevels = levels.filter((l) => list.filter((e) => e.level === l).every((e) => e.solved));
  const all = list.length > 0 && solved.length === list.length;
  return [
    {
      key: "first",
      icon: "⭐",
      title: "Premier pas",
      description: "Réussir un premier exercice",
      earned: solved.length >= 1,
    },
    {
      key: "flawless",
      icon: "🎯",
      title: "Du premier coup",
      description: "Réussir un exercice dès la première soumission",
      earned: firstTry >= 1,
    },
    {
      key: "perseverant",
      icon: "💪",
      title: "Persévérant",
      description: "Réussir un exercice après 3 essais ou plus",
      earned: solved.some((e) => e.attempts >= 3),
    },
    {
      key: "level",
      icon: "🏅",
      title: "Niveau terminé",
      description: "Réussir tous les exercices d'un niveau",
      earned: fullLevels.length >= 1,
    },
    {
      key: "sniper",
      icon: "🔥",
      title: "Sans faute",
      description: "5 exercices réussis du premier coup",
      earned: firstTry >= 5,
    },
    {
      key: "champion",
      icon: "👑",
      title: "Champion",
      description: "Terminer tout le parcours",
      earned: all,
    },
  ];
}

export function computeXp(list: ExerciseProgress[]): number {
  return list.reduce((s, e) => s + (e.solved ? xpForExercise(e.level, e.firstTry) : 0), 0);
}
