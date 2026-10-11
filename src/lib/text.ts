/** Retire les accents : « Éléments » → « Elements ». */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** « Institut Spécialisé de Casablanca » → « institut-specialise-de-casablanca ». */
export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Comparaison insensible à la casse, aux accents et aux espaces superflus. */
export function normalizeKey(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}
