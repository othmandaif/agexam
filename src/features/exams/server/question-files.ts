import "server-only";
import ExcelJS from "exceljs";
import type { CodeLanguage } from "@/domain/enums";
import { parseDuration } from "@/domain/duration";
import {
  buildQuestionText,
  codeLanguageFromTag,
  type QuestionTextInput,
} from "@/domain/question-text";
import { normalizeKey } from "@/lib/text";
import { errors } from "@/server/http/errors";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const LETTERS = "ABCDEFGHIJ".split("");

export interface ConvertedFile {
  text: string;
  questionCount: number;
  /** Lignes ignorées ou corrigées. */
  notes: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  prompt: ["question", "enonce", "intitule", "libelle"],
  code: ["code", "pseudo-code", "pseudo code", "extrait de code"],
  language: ["langage", "language", "langue du code"],
  correct: [
    "bonne reponse",
    "bonnes reponses",
    "bonne(s) reponse(s)",
    "reponse correcte",
    "reponses correctes",
    "correct",
    "answer",
    "solution",
  ],
  duration: ["duree", "temps", "duration", "duree (s)", "duree (secondes)"],
  points: ["points", "bareme", "pts"],
  explanation: ["explication", "explanation", "feedback", "commentaire"],
};

/** Colonne d'option : « A », « Réponse A », « Option A », « Choix A ». */
function optionLetter(header: string): string | null {
  const m = /^(?:reponse|option|choix|proposition)?\s*([a-j])$/.exec(header);
  return m ? m[1]!.toUpperCase() : null;
}

/**
 * Convertit un fichier de questions en texte au format AGExam.
 * .txt : renvoyé tel quel. .xlsx : une ligne par question (voir le modèle).
 */
export async function convertQuestionFile(file: File): Promise<ConvertedFile> {
  if (file.size === 0) throw errors.badRequest("Le fichier est vide.");
  if (file.size > MAX_FILE_BYTES) throw errors.badRequest("Fichier trop lourd (2 Mo maximum).");
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = (await file.text()).replace(/^﻿/, "");
    return { text, questionCount: 0, notes: [] };
  }
  if (!name.endsWith(".xlsx")) {
    throw errors.badRequest("Format non pris en charge. Utilisez .txt ou .xlsx.");
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
    for (let c = 1; c <= row.cellCount; c++) values.push(row.getCell(c).text ?? "");
    table.push(values);
  });

  const headerIndex = table.findIndex((r) => r.some((c) => c.trim()));
  if (headerIndex < 0) throw errors.badRequest("Le fichier est vide.");
  const headers = table[headerIndex]!.map((h) => normalizeKey(h));

  const col: Record<string, number> = {};
  const optionCols: { letter: string; index: number }[] = [];
  headers.forEach((h, index) => {
    const letter = optionLetter(h);
    if (letter) optionCols.push({ letter, index });
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (col[key] === undefined && aliases.includes(h)) col[key] = index;
    }
  });
  optionCols.sort((a, b) => a.letter.localeCompare(b.letter));

  if (col.prompt === undefined || optionCols.length < 2 || col.correct === undefined) {
    throw errors.badRequest(
      "Colonnes introuvables. Il faut au minimum « Question », « A », « B » et « Bonne réponse ». Utilisez le modèle.",
    );
  }

  const cell = (row: string[], index: number | undefined) =>
    index === undefined ? "" : (row[index] ?? "").trim();

  const items: QuestionTextInput[] = [];
  const notes: string[] = [];

  table.slice(headerIndex + 1).forEach((row, i) => {
    const line = headerIndex + i + 2;
    const prompt = cell(row, col.prompt);
    if (!row.some((c) => c.trim())) return;
    if (!prompt) {
      notes.push(`Ligne ${line} ignorée : question vide.`);
      return;
    }
    const correct = new Set(
      cell(row, col.correct)
        .toUpperCase()
        .split(/[\s,;/+]+|\bET\b/)
        .filter((t) => LETTERS.includes(t)),
    );
    const options = optionCols
      .map(({ letter, index }) => ({ letter, label: cell(row, index) }))
      .filter((o) => o.label)
      .map((o) => ({ label: o.label, isCorrect: correct.has(o.letter) }));

    const durationRaw = cell(row, col.duration);
    const durationSec = durationRaw ? parseDuration(durationRaw) : null;
    if (durationRaw && durationSec === null) {
      notes.push(`Ligne ${line} : durée « ${durationRaw} » illisible, durée suggérée utilisée.`);
    }
    const pointsRaw = cell(row, col.points).replace(",", ".");
    const points = pointsRaw ? Number(pointsRaw) : null;

    const code = cell(row, col.code);
    const language: CodeLanguage | null = code
      ? codeLanguageFromTag(cell(row, col.language))
      : null;

    items.push({
      prompt,
      code: code || null,
      codeLanguage: language,
      options,
      durationSec,
      points: points && Number.isFinite(points) ? points : null,
      explanation: cell(row, col.explanation) || null,
    });
  });

  if (items.length === 0) throw errors.badRequest("Aucune question trouvée sous l'en-tête.");
  return { text: buildQuestionText(items), questionCount: items.length, notes };
}

/** Modèle Excel à télécharger, avec une feuille d'explications. */
export async function buildQuestionTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AGExam";
  const sheet = workbook.addWorksheet("Questions");
  sheet.columns = [
    { header: "Question", key: "q", width: 50 },
    { header: "Code", key: "code", width: 36 },
    { header: "Langage", key: "lang", width: 10 },
    { header: "A", key: "a", width: 22 },
    { header: "B", key: "b", width: 22 },
    { header: "C", key: "c", width: 22 },
    { header: "D", key: "d", width: 22 },
    { header: "Bonne réponse", key: "ok", width: 15 },
    { header: "Durée", key: "dur", width: 10 },
    { header: "Points", key: "pts", width: 8 },
    { header: "Explication", key: "exp", width: 40 },
  ];
  sheet.addRow({
    q: "Quelle structure répète un bloc tant qu'une condition est vraie ?",
    a: "Si … Alors",
    b: "TantQue … Faire",
    c: "Selon … Faire",
    d: "Aucune des réponses",
    ok: "B",
    dur: "30s",
  });
  sheet.addRow({
    q: "Quelles instructions ajoutent un élément à la fin d'une liste ?",
    a: "liste.append(x)",
    b: "liste.add(x)",
    c: "liste.insert(len(liste), x)",
    ok: "A, C",
    dur: "1min",
    pts: 2,
  });
  sheet.addRow({
    q: "Quelle valeur affiche l'algorithme ?",
    code: "s ← 0\nPour i ← 1 à 5 Faire\n  Si i Mod 2 = 0 Alors\n    s ← s + i\n  FinSi\nFinPour\nÉcrire(s)",
    lang: "pseudo",
    a: "6",
    b: "9",
    c: "15",
    ok: "A",
    dur: "1min30",
    exp: "Seuls 2 et 4 sont pairs : 2 + 4 = 6.",
  });
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4255FF" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getColumn("code").alignment = { wrapText: true, vertical: "top" };

  const help = workbook.addWorksheet("Mode d'emploi");
  help.getColumn(1).width = 100;
  [
    "Une ligne = une question.",
    "Colonnes A à J : les réponses proposées (2 minimum). Ajoutez E, F… si besoin.",
    "Bonne réponse : la lettre (B) ou plusieurs lettres séparées par une virgule (A, C) pour un QCM à plusieurs réponses.",
    "Durée (facultatif) : 30s, 45, 1min, 1min30, 1:30… Sans durée, une durée est proposée automatiquement.",
    "Points (facultatif) : 1 par défaut.",
    "Code (facultatif) : collez le code ; Alt+Entrée pour aller à la ligne dans une cellule. Langage : pseudo, python, sql, js, c, java.",
  ].forEach((line) => help.addRow([line]));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
