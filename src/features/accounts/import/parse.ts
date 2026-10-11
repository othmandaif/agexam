import { z } from "zod";
import { normalizeKey } from "@/lib/text";

/** Limite par import : la création de comptes Supabase se fait une par une. */
export const MAX_IMPORT_ROWS = 300;

export interface ParsedRow {
  /** Numéro de ligne dans le fichier (1 = en-tête). */
  line: number;
  fullName: string;
  email: string;
  groupName: string | null;
  errors: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Erreur bloquante (colonnes manquantes, fichier vide, trop de lignes). */
  fatal?: string;
}

const HEADERS = {
  fullName: [
    "nom complet",
    "nom et prenom",
    "nom prenom",
    "prenom nom",
    "full name",
    "etudiant",
    "stagiaire",
  ],
  lastName: ["nom", "nom de famille", "last name"],
  firstName: ["prenom", "first name"],
  email: ["e-mail", "email", "mail", "adresse e-mail", "adresse email", "courriel"],
  group: ["groupe", "group", "classe"],
} as const;

type Column = keyof typeof HEADERS;

function findColumns(header: string[]): Partial<Record<Column, number>> {
  const keys = header.map(normalizeKey);
  const result: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(HEADERS) as Column[]) {
    const index = keys.findIndex((k) => (HEADERS[column] as readonly string[]).includes(k));
    if (index >= 0) result[column] = index;
  }
  return result;
}

const emailSchema = z.email();

/**
 * Lit les lignes d'un tableau (en-tête + données) et valide chaque ligne.
 * Colonnes reconnues : « Nom complet » (ou « Prénom » + « Nom »), « E-mail », « Groupe ».
 */
export function parseStudentSheet(table: string[][]): ParseResult {
  const firstIndex = table.findIndex((row) => row.some((c) => c.trim() !== ""));
  if (firstIndex < 0) return { rows: [], fatal: "Le fichier est vide." };

  const cols = findColumns(table[firstIndex]!);
  const hasName = cols.fullName !== undefined || cols.lastName !== undefined;
  if (!hasName || cols.email === undefined) {
    return {
      rows: [],
      fatal:
        "Colonnes introuvables. La première ligne doit contenir « Nom complet » et « E-mail » (et « Groupe » si besoin). Utilisez le modèle.",
    };
  }

  const cell = (row: string[], index: number | undefined) =>
    index === undefined ? "" : (row[index] ?? "").replace(/\s+/g, " ").trim();

  const seen = new Map<string, number>();
  const rows: ParsedRow[] = [];

  table.slice(firstIndex + 1).forEach((row, i) => {
    if (!row.some((c) => c.trim() !== "")) return;
    const line = firstIndex + i + 2;

    let fullName = cell(row, cols.fullName);
    if (!fullName) {
      fullName = [cell(row, cols.firstName), cell(row, cols.lastName)].filter(Boolean).join(" ");
    }
    const email = cell(row, cols.email).toLowerCase();
    const groupRaw = cell(row, cols.group).toUpperCase();
    const errors: string[] = [];

    if (fullName.length < 2) errors.push("Nom manquant.");
    if (fullName.length > 120) errors.push("Nom trop long (120 caractères max.).");
    if (!email) errors.push("E-mail manquant.");
    else if (!emailSchema.safeParse(email).success) errors.push("E-mail invalide.");
    if (groupRaw.length > 40) errors.push("Nom de groupe trop long (40 caractères max.).");

    if (email && seen.has(email)) {
      errors.push(`E-mail en double (déjà ligne ${seen.get(email)}).`);
    } else if (email) {
      seen.set(email, line);
    }

    rows.push({ line, fullName, email, groupName: groupRaw || null, errors });
  });

  if (rows.length === 0) return { rows, fatal: "Aucune ligne d'étudiant trouvée sous l'en-tête." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      fatal: `Trop de lignes (${rows.length}). Maximum ${MAX_IMPORT_ROWS} par import : découpez le fichier.`,
    };
  }
  return { rows };
}

/** Détecte le séparateur d'un CSV (« ; » pour Excel en français, sinon « , »). */
function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

/** Analyseur CSV minimal : guillemets, guillemets doublés, retours à la ligne dans un champ. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
