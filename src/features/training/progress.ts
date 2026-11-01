/**
 * Déblocage des niveaux : le premier niveau est ouvert ; un niveau s'ouvre dès
 * qu'un exercice du niveau précédent est réussi. Un niveau où l'étudiant a
 * déjà réussi reste ouvert (même si le formateur insère un niveau avant).
 */
export function unlockedLevels(levels: number[], solvedLevels: Set<number>): Set<number> {
  const sorted = [...new Set(levels)].sort((a, b) => a - b);
  const open = new Set<number>();
  sorted.forEach((level, i) => {
    if (i === 0 || solvedLevels.has(sorted[i - 1]!) || solvedLevels.has(level)) open.add(level);
  });
  return open;
}
