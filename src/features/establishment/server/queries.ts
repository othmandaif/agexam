import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { chapters, establishments, modules, questions } from "@/server/db/schema";

export async function getEstablishment(establishmentId: string) {
  const [row] = await getDb()
    .select({ id: establishments.id, name: establishments.name, slug: establishments.slug })
    .from(establishments)
    .where(eq(establishments.id, establishmentId))
    .limit(1);
  return row ?? null;
}

export async function listModules(establishmentId: string) {
  const db = getDb();
  return db
    .select({
      id: modules.id,
      code: modules.code,
      name: modules.name,
      chapterCount: db.$count(chapters, eq(chapters.moduleId, modules.id)),
      questionCount: db.$count(
        questions,
        and(eq(questions.moduleId, modules.id), isNull(questions.archivedAt)),
      ),
    })
    .from(modules)
    .where(eq(modules.establishmentId, establishmentId))
    .orderBy(asc(modules.code));
}

/** Module + chapitres, uniquement s'il appartient à l'établissement. */
export async function getModuleWithChapters(establishmentId: string, moduleId: string) {
  const db = getDb();
  const [module] = await db
    .select({ id: modules.id, code: modules.code, name: modules.name })
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.establishmentId, establishmentId)))
    .limit(1);
  if (!module) return null;

  const chapterRows = await db
    .select({
      id: chapters.id,
      name: chapters.name,
      position: chapters.position,
      questionCount: db.$count(
        questions,
        and(eq(questions.chapterId, chapters.id), isNull(questions.archivedAt)),
      ),
    })
    .from(chapters)
    .where(eq(chapters.moduleId, moduleId))
    .orderBy(asc(chapters.position), asc(chapters.name));

  return { ...module, chapters: chapterRows };
}
