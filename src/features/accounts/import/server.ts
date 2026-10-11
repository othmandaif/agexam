import "server-only";
import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import { normalizeKey } from "@/lib/text";
import { audit } from "@/server/audit";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { groups, profiles } from "@/server/db/schema";
import { AppError, errors } from "@/server/http/errors";
import { createAccount } from "../server/service";
import { MAX_IMPORT_ROWS, parseCsv, parseStudentSheet, type ParsedRow } from "./parse";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** reactivate : étudiant d'une année passée, réinscrit pour l'année courante. */
export type RowStatus = "create" | "reactivate" | "exists" | "error";

export interface PreviewRow extends ParsedRow {
  status: RowStatus;
  /** Le groupe n'existe pas encore : il sera créé. */
  newGroup: boolean;
}

export interface ImportPreview {
  fileName: string;
  rows: PreviewRow[];
  summary: {
    create: number;
    reactivate: number;
    exists: number;
    error: number;
    newGroups: string[];
  };
  /** Import d'un formateur : tous les étudiants vont dans ce groupe existant. */
  targetGroup: { id: string; name: string } | null;
}

export interface ImportedAccount {
  line: number;
  fullName: string;
  email: string;
  groupName: string | null;
  tempPassword: string;
}

export interface ImportResult {
  created: ImportedAccount[];
  failed: { line: number; email: string; reason: string }[];
}

/** Lit la première feuille d'un .xlsx ou un .csv en tableau de chaînes. */
async function readTable(file: File): Promise<string[][]> {
  if (file.size === 0) throw errors.badRequest("Le fichier est vide.");
  if (file.size > MAX_FILE_BYTES) throw errors.badRequest("Fichier trop lourd (2 Mo maximum).");

  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (!name.endsWith(".xlsx")) {
    throw errors.badRequest("Format non pris en charge. Utilisez un fichier .xlsx ou .csv.");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw errors.badRequest("Fichier Excel illisible. Enregistrez-le de nouveau au format .xlsx.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw errors.badRequest("Le classeur ne contient aucune feuille.");

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      // .text gère les liens hypertexte (e-mails), formules et textes enrichis.
      values.push(row.getCell(c).text ?? "");
    }
    table.push(values);
  });
  return table;
}

/** Analyse le fichier et indique, ligne par ligne, ce qui sera fait. Ne modifie rien. */
/**
 * Groupe cible d'un import : obligatoire pour un formateur (groupe existant de
 * l'année courante, aucune création), facultatif pour l'administration.
 */
export async function resolveTargetGroup(
  actor: TenantUser,
  groupId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!groupId) {
    if (actor.role !== "ADMIN") {
      throw errors.badRequest("Choisissez le groupe dans lequel importer les étudiants.");
    }
    return null;
  }
  const [g] = await getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.establishmentId, actor.establishmentId),
        eq(groups.academicYear, currentAcademicYear()),
      ),
    )
    .limit(1);
  if (!g) throw errors.badRequest("Groupe introuvable pour l'année en cours.");
  return g;
}

export async function previewImport(
  actor: TenantUser,
  file: File,
  groupId: string | null,
): Promise<ImportPreview> {
  const targetGroup = await resolveTargetGroup(actor, groupId);
  const parsed = parseStudentSheet(await readTable(file));
  if (parsed.fatal) throw errors.badRequest(parsed.fatal);
  return {
    fileName: file.name,
    targetGroup,
    ...(await classifyRows(actor, parsed.rows, targetGroup)),
  };
}

async function classifyRows(
  actor: TenantUser,
  rows: ParsedRow[],
  targetGroup: { id: string; name: string } | null,
) {
  const db = getDb();
  const year = currentAcademicYear();
  const emails = rows.filter((r) => r.errors.length === 0).map((r) => r.email);

  // Les e-mails sont uniques dans tout Supabase Auth, tous établissements confondus.
  const existing = emails.length
    ? await db
        .select({
          email: profiles.email,
          role: profiles.role,
          establishmentId: profiles.establishmentId,
          academicYear: profiles.academicYear,
        })
        .from(profiles)
        .where(inArray(profiles.email, emails))
    : [];
  const existingByEmail = new Map(existing.map((e) => [e.email.toLowerCase(), e]));

  const groupRows = await db
    .select({ name: groups.name })
    .from(groups)
    .where(and(eq(groups.establishmentId, actor.establishmentId), eq(groups.academicYear, year)));
  const knownGroups = new Set(groupRows.map((g) => normalizeKey(g.name)));

  const newGroups = new Set<string>();
  const previewRows: PreviewRow[] = rows.map((raw) => {
    // Import d'un formateur : la colonne Groupe est remplacée par le groupe choisi.
    const row = targetGroup ? { ...raw, groupName: targetGroup.name } : raw;
    const found = existingByEmail.get(row.email);
    const status: RowStatus =
      row.errors.length > 0
        ? "error"
        : !found
          ? "create"
          : found.role === "ETUDIANT" &&
              found.establishmentId === actor.establishmentId &&
              found.academicYear < year
            ? "reactivate"
            : "exists";
    const newGroup =
      !targetGroup &&
      (status === "create" || status === "reactivate") &&
      !!row.groupName &&
      !knownGroups.has(normalizeKey(row.groupName));
    if (newGroup) newGroups.add(row.groupName!);
    return { ...row, status, newGroup };
  });

  return {
    rows: previewRows,
    summary: {
      create: previewRows.filter((r) => r.status === "create").length,
      reactivate: previewRows.filter((r) => r.status === "reactivate").length,
      exists: previewRows.filter((r) => r.status === "exists").length,
      error: previewRows.filter((r) => r.status === "error").length,
      newGroups: [...newGroups],
    },
  };
}

/** Exécute des tâches avec une concurrence limitée. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Crée les groupes manquants puis les comptes. Les lignes sont revalidées ici :
 * le navigateur a pu modifier l'aperçu.
 */
export async function runImport(
  actor: TenantUser,
  submitted: ParsedRow[],
  groupId: string | null,
): Promise<ImportResult> {
  const targetGroup = await resolveTargetGroup(actor, groupId);
  const reparsed = parseStudentSheet([
    ["Nom complet", "E-mail", "Groupe"],
    ...submitted.map((r) => [r.fullName, r.email, r.groupName ?? ""]),
  ]);
  if (reparsed.fatal) throw errors.badRequest(reparsed.fatal);

  const { rows } = await classifyRows(actor, reparsed.rows, targetGroup);
  // Les numéros de ligne d'origine sont conservés pour le rapport.
  rows.forEach((r, i) => (r.line = submitted[i]?.line ?? r.line));
  const toCreate = rows.filter((r) => r.status === "create" || r.status === "reactivate");
  if (toCreate.length === 0) throw errors.badRequest("Aucun compte à créer.");

  const db = getDb();
  const year = currentAcademicYear();
  // Formateur : uniquement le groupe choisi (jamais de création de groupe).
  const wantedGroups = targetGroup
    ? []
    : ([...new Set(toCreate.map((r) => r.groupName).filter(Boolean))] as string[]);
  if (wantedGroups.length > 0) {
    await db
      .insert(groups)
      .values(wantedGroups.map((name) => ({ name, establishmentId: actor.establishmentId })))
      .onConflictDoNothing();
  }
  const groupIds = new Map(
    (wantedGroups.length
      ? await db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(
            and(
              eq(groups.establishmentId, actor.establishmentId),
              eq(groups.academicYear, year),
              inArray(groups.name, wantedGroups),
            ),
          )
      : []
    ).map((g) => [g.name, g.id]),
  );
  if (targetGroup) groupIds.set(targetGroup.name, targetGroup.id);

  const created: ImportedAccount[] = [];
  const failed: ImportResult["failed"] = [];

  await mapLimit(toCreate, 4, async (row) => {
    try {
      const { tempPassword } = await createAccount(actor, {
        fullName: row.fullName,
        email: row.email,
        role: "ETUDIANT",
        groupId: row.groupName ? (groupIds.get(row.groupName) ?? null) : null,
      });
      created.push({
        line: row.line,
        fullName: row.fullName,
        email: row.email,
        groupName: row.groupName,
        tempPassword,
      });
    } catch (error) {
      failed.push({
        line: row.line,
        email: row.email,
        reason: error instanceof AppError ? error.message : "Erreur inattendue.",
      });
    }
  });

  created.sort((a, b) => a.line - b.line);
  failed.sort((a, b) => a.line - b.line);

  await audit(db, {
    actorId: actor.id,
    action: "account.import",
    entityType: "establishment",
    entityId: actor.establishmentId,
    payload: { created: created.length, failed: failed.length, groups: wantedGroups },
  });

  return { created, failed };
}

/** Modèle Excel à télécharger. */
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF315BEF" },
};

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * Modèle à remplir : colonnes Nom complet / E-mail / Groupe, liste déroulante
 * des groupes existants (un nouveau nom reste accepté : le groupe est créé),
 * et une feuille d'instructions.
 */
export async function buildImportTemplate(
  groupNames: string[] = [],
  options: { withGroupColumn?: boolean } = {},
): Promise<Buffer> {
  // Formateur : pas de colonne Groupe (le groupe est choisi au moment de l'import).
  const withGroup = options.withGroupColumn ?? true;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Étudiants");
  sheet.columns = [
    { header: "Nom complet", key: "fullName", width: 32 },
    { header: "E-mail", key: "email", width: 36 },
    ...(withGroup ? [{ header: "Groupe", key: "group", width: 18 }] : []),
  ];
  const example = groupNames[0] ?? "DEV101";
  sheet.addRow({ fullName: "Salma Benali", email: "salma.benali@exemple.ma", group: example });
  sheet.addRow({
    fullName: "Yassine El Amrani",
    email: "yassine.elamrani@exemple.ma",
    group: example,
  });
  for (const r of [2, 3]) sheet.getRow(r).font = { italic: true, color: { argb: "FF94A3B8" } };
  styleHeaderRow(sheet);

  if (withGroup) {
    // Groupes existants de l'année + liste déroulante (avertissement seulement).
    const lists = workbook.addWorksheet("Groupes existants");
    lists.columns = [{ header: "Groupes de l'année", key: "name", width: 30 }];
    groupNames.forEach((name) => lists.addRow({ name }));
    styleHeaderRow(lists);
    if (groupNames.length > 0) {
      for (let r = 2; r <= MAX_IMPORT_ROWS + 1; r++) {
        sheet.getCell(r, 3).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'Groupes existants'!$A$2:$A$${groupNames.length + 1}`],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: "Nouveau groupe ?",
          error: "Ce groupe n'existe pas encore : il sera créé à l'import.",
        };
      }
    }
  }

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 100 }];
  [
    "Comment remplir ce fichier",
    "",
    "1. Une ligne par étudiant, dans la feuille « Étudiants » (remplacez les 2 lignes d'exemple).",
    "2. Nom complet : prénom et nom, tels qu'ils apparaîtront sur les copies et les PDF.",
    "3. E-mail : adresse de connexion, unique. Un étudiant d'une année passée est réinscrit.",
    withGroup
      ? "4. Groupe (facultatif) : choisissez dans la liste ou tapez un nouveau nom (il sera créé)."
      : "4. Le groupe se choisit dans AGExam au moment de l'import : tous les étudiants du fichier y sont inscrits.",
    `5. ${MAX_IMPORT_ROWS} lignes maximum par fichier. Formats acceptés : .xlsx ou .csv.`,
    "",
    "Après l'import, un mot de passe provisoire est généré pour chaque compte :",
    "téléchargez la liste des identifiants à la fin de l'import pour la remettre aux étudiants.",
  ].forEach((line, i) => {
    const row = help.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 14 };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface StudentExportRow {
  fullName: string;
  email: string;
  groupNames: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

/**
 * Liste des étudiants en Excel. Les 3 premières colonnes reprennent celles du
 * modèle d'import (le fichier peut servir de base à un nouvel import).
 */
export async function buildStudentsExport(
  rows: StudentExportRow[],
  title: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Étudiants", {
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = [
    { header: "Nom complet", key: "fullName", width: 32 },
    { header: "E-mail", key: "email", width: 36 },
    { header: "Groupe", key: "group", width: 22 },
    { header: "Compte", key: "state", width: 14 },
    { header: "Première connexion", key: "first", width: 20 },
  ];
  rows.forEach((r) =>
    sheet.addRow({
      fullName: r.fullName,
      email: r.email,
      group: r.groupNames ?? "",
      state: r.isActive ? "Actif" : "Désactivé",
      first: r.mustChangePassword ? "Pas encore" : "Faite",
    }),
  );
  styleHeaderRow(sheet);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: 5 },
  };
  sheet.headerFooter = { oddFooter: `&L${title.replace(/&/g, "&&")}&RPage &P / &N` };
  sheet.pageSetup.printTitlesRow = "1:1";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
