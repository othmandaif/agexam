import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { formatDate } from "@/lib/datetime";
import { getDb } from "@/server/db/client";

/** En-tête officiel des documents exportés (PDF / Excel). */
export interface ExportMeta {
  establishment: string;
  module: string | null;
  groups: string;
  trainer: string | null;
  /** Date de l'épreuve (ouverture, sinon création), au format long. */
  date: string;
}

export async function getExportMeta(examId: string): Promise<ExportMeta> {
  const [row] = (await getDb().execute(sql`
    select est.name as establishment,
      case when m.id is null then null else m.code || ' · ' || m.name end as module,
      concat_ws(' + ',
        (select string_agg(g.name, ', ' order by g.name)
           from exam_groups eg join groups g on g.id = eg.group_id
          where eg.exam_id = e.id),
        (select case when count(*) = 0 then null
                     when count(*) = 1 then '1 étudiant ajouté'
                     else count(*) || ' étudiants ajoutés' end
           from exam_candidates ec where ec.exam_id = e.id)
      ) as groups,
      p.full_name as trainer,
      coalesce(e.opens_at, e.created_at) as exam_at
    from exams e
    join establishments est on est.id = e.establishment_id
    left join modules m on m.id = e.module_id
    left join profiles p on p.id = e.author_id
    where e.id = ${examId}
  `)) as unknown as {
    establishment: string;
    module: string | null;
    groups: string;
    trainer: string | null;
    exam_at: string;
  }[];
  return {
    establishment: row?.establishment ?? "",
    module: row?.module ?? null,
    groups: row?.groups ?? "",
    trainer: row?.trainer ?? null,
    date: row ? formatDate(new Date(row.exam_at)) : "",
  };
}

let logoCache: { buf: Buffer | null; ext: "png" | "jpeg" } | undefined;

/**
 * Logo OFPPT : `public/ofppt.png` (ou .jpg) s'il est présent, sinon rien
 * (l'en-tête affiche alors le sigle en texte).
 */
export function officialLogo(): { buf: Buffer; ext: "png" | "jpeg" } | null {
  if (logoCache === undefined || process.env.NODE_ENV !== "production") {
    const base = path.join(/* turbopackIgnore: true */ process.cwd(), "public");
    const candidates: [string, "png" | "jpeg"][] = [
      ["ofppt.png", "png"],
      ["ofppt.jpg", "jpeg"],
      ["ofppt.jpeg", "jpeg"],
    ];
    const hit = candidates.find(([f]) => existsSync(path.join(base, f)));
    logoCache = hit
      ? { buf: readFileSync(path.join(base, hit[0])), ext: hit[1] }
      : { buf: null, ext: "png" };
  }
  return logoCache.buf ? { buf: logoCache.buf, ext: logoCache.ext } : null;
}

/** Nom de fichier sûr (sans accents ni caractères spéciaux). */
export function fileSlug(text: string, fallback = "examen"): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || fallback
  );
}
