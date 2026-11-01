/**
 * Déblocage des niveaux : le premier niveau est ouvert ; un niveau ne s'ouvre que
 * lorsque TOUS les exercices du niveau précédent sont réussis. Un niveau où
 * l'étudiant a déjà réussi reste ouvert (même si le formateur insère un niveau avant).
 */
export function unlockedLevels(
  exercises: { id: string; level: number }[],
  solved: Set<string>,
): Set<number> {
  const sorted = [...new Set(exercises.map((e) => e.level))].sort((a, b) => a - b);
  const complete = (level: number) =>
    exercises.filter((e) => e.level === level).every((e) => solved.has(e.id));
  const started = (level: number) => exercises.some((e) => e.level === level && solved.has(e.id));
  const open = new Set<number>();
  sorted.forEach((level, i) => {
    if (i === 0 || complete(sorted[i - 1]!) || started(level)) open.add(level);
  });
  return open;
}
