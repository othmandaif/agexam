/** Pagination côté serveur : paramètres d'URL ?page=&taille=. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface PageParams {
  page: number;
  size: number;
  offset: number;
}

export function parsePageParams(
  sp: { page?: string; taille?: string },
  defaultSize: number = DEFAULT_PAGE_SIZE,
): PageParams {
  const size = (PAGE_SIZES as readonly number[]).includes(Number(sp.taille))
    ? Number(sp.taille)
    : defaultSize;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  return { page, size, offset: (page - 1) * size };
}

/** Page affichée ramenée dans les bornes une fois le total connu. */
export function clampPage(p: PageParams, total: number): PageParams {
  const last = Math.max(1, Math.ceil(total / p.size));
  const page = Math.min(p.page, last);
  return { ...p, page, offset: (page - 1) * p.size };
}
