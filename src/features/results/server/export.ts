import "server-only";
import ExcelJS from "exceljs";
import { eq, inArray, sql } from "drizzle-orm";
import { formatDateTime } from "@/lib/datetime";
import { getDb } from "@/server/db/client";
import { attemptQuestions, examQuestions } from "@/server/db/schema";
import { RELEASE_LABELS, VISIBILITY_LABELS } from "@/features/exams/schemas";
import { RESULT_STATUS_LABELS, SIGNAL_LABELS } from "../labels";
import type { ExamResults, ResultStudent } from "../types";

/** Sélection, ou un marqueur si un algorithme a été rendu (question d'algorithme). */
const answeredSql = sql<
  string[]
>`case when coalesce(btrim(${attemptQuestions.codeAnswer}), '') <> ''
  then '["code"]'::jsonb else ${attemptQuestions.selectedOptionIds} end`;
import { officialLogo, type ExportMeta } from "./export-meta";

const BRAND = "FF4255FF";
const RED_BG = "FFFFE4E4";
const GREEN_BG = "FFDDFBEC";
const GREY_BG = "FFEEF0F5";

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});
const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
const date = (iso: string | null) => (iso ? formatDateTime(new Date(iso)) : "");
const minutes = (sec: number | null) => (sec === null ? null : Math.round((sec / 60) * 10) / 10);

/** Classeur Excel : synthèse, notes, analyse par question, grille des réponses. */
export async function buildResultsWorkbook(results: ExamResults): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "";
  wb.created = new Date();
  const { exam, summary } = results;

  // ── Synthèse ──────────────────────────────────────────────────────────────
  const info = wb.addWorksheet("Synthèse");
  info.columns = [{ width: 30 }, { width: 48 }];
  info.addRow(["Examen", exam.title]).font = { bold: true, size: 14 };
  info.addRows([
    ["Ouverture", date(exam.opensAt)],
    ["Fermeture", date(exam.closesAt)],
    [
      "Diffusion aux étudiants",
      `${VISIBILITY_LABELS[exam.resultVisibility].title} · ${RELEASE_LABELS[exam.resultReleaseMode]}`,
    ],
    [],
    ["Inscrits", summary.enrolled],
    ["Copies notées", summary.submitted],
    ["Absents", summary.absent],
    ["Copies à revoir", summary.flagged],
    [],
    ["Moyenne /20", summary.mean],
    ["Médiane /20", summary.median],
    ["Écart-type", summary.stdDev],
    ["Note min.", summary.min],
    ["Note max.", summary.max],
    ["Taux de réussite (≥ 10)", pct(summary.passRate)],
    [],
    ["Exporté le", formatDateTime(new Date())],
  ]);
  info.getCell("B16").numFmt = "0.0%";
  info.getColumn(1).font = { bold: true };

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes = wb.addWorksheet("Notes");
  notes.columns = [
    { header: "Étudiant", key: "name", width: 28 },
    { header: "E-mail", key: "email", width: 32 },
    { header: "Groupe", key: "groups", width: 14 },
    { header: "Statut", key: "status", width: 18 },
    { header: "Note /20", key: "score", width: 10, style: { numFmt: "0.00" } },
    { header: "Points", key: "points", width: 10 },
    { header: "Rang", key: "rank", width: 7 },
    { header: "Bonnes réponses", key: "correct", width: 10 },
    { header: "Répondues", key: "answered", width: 10 },
    { header: "Questions", key: "total", width: 10 },
    { header: "Sorties du mode examen", key: "violations", width: 12 },
    { header: "À revoir", key: "flagged", width: 9 },
    { header: "Début", key: "startedAt", width: 20 },
    { header: "Fin", key: "submittedAt", width: 20 },
    { header: "Durée (min)", key: "duration", width: 10 },
    { header: "Reçu", key: "receipt", width: 12 },
  ];
  for (const s of results.students) {
    const row = notes.addRow({
      name: s.fullName,
      email: s.email,
      groups: s.groups,
      status: RESULT_STATUS_LABELS[s.status],
      score: s.scoreOutOf20,
      points:
        s.scoreAwarded !== null && s.scoreMax !== null && s.scoreOutOf20 !== null
          ? `${s.scoreAwarded}/${s.scoreMax}`
          : "",
      rank: s.rank,
      correct: s.status === "ABSENT" ? null : s.correct,
      answered: s.status === "ABSENT" ? null : s.answered,
      total: s.status === "ABSENT" ? null : s.total,
      violations: s.status === "ABSENT" ? null : s.violationCount,
      flagged: s.flagged ? "Oui" : "",
      startedAt: date(s.startedAt),
      submittedAt: date(s.submittedAt),
      duration: minutes(s.durationSec),
      receipt: s.receiptCode ?? "",
    });
    if (s.scoreOutOf20 !== null) {
      row.getCell("score").fill = fill(s.scoreOutOf20 >= 10 ? GREEN_BG : RED_BG);
    }
    if (s.status === "ABSENT") row.font = { color: { argb: "FF586380" }, italic: true };
  }
  styleHeader(notes);

  // ── Questions ─────────────────────────────────────────────────────────────
  const qs = wb.addWorksheet("Questions");
  const maxOptions = Math.max(0, ...results.questions.map((q) => q.options.length));
  qs.columns = [
    { header: "N°", key: "n", width: 5 },
    { header: "Énoncé", key: "prompt", width: 60 },
    { header: "Statut", key: "state", width: 13 },
    { header: "Points", key: "points", width: 8 },
    { header: "Durée (s)", key: "duration", width: 9 },
    { header: "Copies", key: "responses", width: 8 },
    { header: "Réussite", key: "success", width: 10, style: { numFmt: "0%" } },
    { header: "Discrimination", key: "disc", width: 13, style: { numFmt: "0.00" } },
    { header: "Temps moyen (s)", key: "time", width: 10 },
    { header: "Bonne(s) réponse(s)", key: "key", width: 14 },
    { header: "Signaux", key: "signals", width: 30 },
    ...Array.from({ length: maxOptions }, (_, i) => ({
      header: `Choix ${String.fromCharCode(65 + i)}`,
      key: `opt${i}`,
      width: 9,
    })),
  ];
  for (const q of results.questions) {
    const a = q.analysis;
    const row = qs.addRow({
      n: q.number,
      prompt: q.prompt,
      state: q.neutralized ? "Neutralisée" : "Comptée",
      points: q.points,
      duration: q.durationSec,
      responses: a.responses,
      success: a.successRate,
      disc: a.discrimination,
      time: a.avgTimeSec,
      key: q.options
        .map((o, i) => (o.isCorrect ? String.fromCharCode(65 + i) : null))
        .filter(Boolean)
        .join(", "),
      signals: a.signals.map((s) => SIGNAL_LABELS[s]).join(" · "),
      ...Object.fromEntries(q.options.map((o, i) => [`opt${i}`, a.choiceCounts[o.id] ?? 0])),
    });
    row.alignment = { vertical: "top", wrapText: true };
    q.options.forEach((o, i) => {
      if (o.isCorrect) row.getCell(`opt${i}`).fill = fill(GREEN_BG);
    });
    if (q.neutralized) row.font = { color: { argb: "FF586380" }, strike: true };
    else if (a.signals.length) row.getCell("signals").fill = fill(RED_BG);
  }
  styleHeader(qs);

  // ── Grille des réponses ───────────────────────────────────────────────────
  const graded = results.students.filter((s) => s.scoreOutOf20 !== null && s.attemptId);
  const grid = wb.addWorksheet("Grille");
  grid.columns = [
    { header: "Étudiant", key: "name", width: 28 },
    { header: "Note /20", key: "score", width: 10, style: { numFmt: "0.00" } },
    ...results.questions.map((q) => ({ header: `Q${q.number}`, key: `q${q.number}`, width: 6 })),
  ];
  if (graded.length) {
    const rows = await getDb()
      .select({
        attemptId: attemptQuestions.attemptId,
        number: examQuestions.position,
        status: attemptQuestions.status,
        isCorrect: attemptQuestions.isCorrect,
        selected: answeredSql,
      })
      .from(attemptQuestions)
      .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
      .where(
        inArray(
          attemptQuestions.attemptId,
          graded.map((s) => s.attemptId!),
        ),
      );
    const cells = new Map(rows.map((r) => [`${r.attemptId}:${r.number + 1}`, r]));
    for (const s of graded) {
      const row = grid.addRow({ name: s.fullName, score: s.scoreOutOf20 });
      for (const q of results.questions) {
        const c = cells.get(`${s.attemptId}:${q.number}`);
        const cell = row.getCell(`q${q.number}`);
        cell.alignment = { horizontal: "center" };
        if (!c || q.neutralized || c.status === "NEUTRALISEE") {
          cell.value = "N";
          cell.fill = fill(GREY_BG);
        } else if (c.status === "INVALIDEE") {
          cell.value = "X";
          cell.fill = fill(RED_BG);
        } else if (c.status === "A_VENIR" || c.selected.length === 0) {
          cell.value = "–";
        } else if (c.isCorrect) {
          cell.value = 1;
          cell.fill = fill(GREEN_BG);
        } else {
          cell.value = 0;
          cell.fill = fill(RED_BG);
        }
      }
    }
  }
  styleHeader(grid);
  grid.addRow([]);
  grid.addRow([
    "Légende : 1 juste · 0 faux · – sans réponse · X invalidée (sanction) · N neutralisée",
  ]).font = {
    italic: true,
    color: { argb: "FF586380" },
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

type GridCell = { value: string | number; fill?: string };

/** Cellule de la grille pour une question d'une copie (1, 0, –, X, N). */
async function loadGridCells(results: ExamResults) {
  const graded = results.students.filter((s) => s.scoreOutOf20 !== null && s.attemptId);
  const cells = new Map<string, GridCell>();
  if (graded.length === 0) return cells;
  const rows = await getDb()
    .select({
      attemptId: attemptQuestions.attemptId,
      position: examQuestions.position,
      status: attemptQuestions.status,
      isCorrect: attemptQuestions.isCorrect,
      selected: answeredSql,
    })
    .from(attemptQuestions)
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .where(
      inArray(
        attemptQuestions.attemptId,
        graded.map((s) => s.attemptId!),
      ),
    );
  const neutralized = new Set(results.questions.filter((q) => q.neutralized).map((q) => q.number));
  for (const r of rows) {
    const number = r.position + 1;
    let cell: GridCell;
    if (neutralized.has(number) || r.status === "NEUTRALISEE") cell = { value: "N", fill: GREY_BG };
    else if (r.status === "INVALIDEE") cell = { value: "X", fill: RED_BG };
    else if (r.status === "A_VENIR" || r.selected.length === 0) cell = { value: "–" };
    else if (r.isCorrect) cell = { value: 1, fill: GREEN_BG };
    else cell = { value: 0, fill: RED_BG };
    cells.set(`${r.attemptId}:${number}`, cell);
  }
  return cells;
}

/**
 * Grille d'évaluation compacte (une feuille, prête à imprimer en paysage) :
 * un étudiant par ligne, une colonne par question, total, note et résultat.
 */
export async function buildEvaluationGrid(
  results: ExamResults,
  meta: ExportMeta,
  list: ResultStudent[] = results.students,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "";
  wb.created = new Date();
  const { exam, summary, questions } = results;
  const sheet = wb.addWorksheet("Grille d'évaluation", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
    },
    headerFooter: {
      oddFooter: `&L${exam.title.replace(/&/g, "&&")}&RPage &P / &N`,
    },
  });
  const cells = await loadGridCells(results);
  const qCols = questions.length;
  const extraCols = 7; // Justes, Fausses, Sans rép., Note, Résultat, Durée, Remise
  const totalCols = 3 + qCols + extraCols;

  // En-tête officiel : logo OFPPT (s'il est fourni), établissement, épreuve.
  const logo = officialLogo();
  const textCol = logo ? 3 : 1;
  if (logo) {
    const id = wb.addImage({ buffer: logo.buf as unknown as ExcelJS.Buffer, extension: logo.ext });
    sheet.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 56 } });
  }
  sheet.mergeCells(1, textCol, 1, totalCols);
  sheet.getCell(1, textCol).value = meta.establishment.toUpperCase();
  sheet.getCell(1, textCol).font = { bold: true, size: 10, color: { argb: "FF586380" } };
  sheet.mergeCells(2, textCol, 2, totalCols);
  sheet.getCell(2, textCol).value = `Grille d'évaluation · ${exam.title}`;
  sheet.getCell(2, textCol).font = { bold: true, size: 14 };
  sheet.mergeCells(3, textCol, 3, totalCols);
  sheet.getCell(3, textCol).value = [
    `Module : ${meta.module ?? "—"}`,
    `Groupe(s) : ${meta.groups || "—"}`,
    `Date : ${meta.date || "—"}`,
    `Formateur : ${meta.trainer ?? "—"}`,
  ].join("   ·   ");
  sheet.getCell(3, textCol).font = { size: 10 };
  sheet.mergeCells(4, textCol, 4, totalCols);
  sheet.getCell(4, textCol).value = [
    `${summary.submitted}/${summary.enrolled} copies notées`,
    summary.mean !== null ? `moyenne ${summary.mean.toFixed(2).replace(".", ",")}/20` : null,
    summary.passRate !== null ? `réussite ${Math.round(summary.passRate * 100)} %` : null,
    exam.bonusPoints > 0 ? `bonus de classe +${String(exam.bonusPoints).replace(".", ",")}` : null,
    list.length !== results.students.length ? `${list.length} étudiant(s) filtré(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  sheet.getCell(4, textCol).font = { color: { argb: "FF586380" }, size: 10 };
  for (const r of [1, 2, 3, 4]) sheet.getRow(r).height = r === 2 ? 22 : 16;

  const headerRow = 6;
  sheet.getRow(headerRow).values = [
    "N°",
    "Nom et prénom",
    "Groupe",
    ...questions.map((q) => `Q${q.number}`),
    "Justes",
    "Fausses",
    "Sans rép.",
    "Note /20",
    "Résultat",
    "Durée (min)",
    "Remise",
  ];
  sheet.columns = [
    { width: 5 },
    { width: 28 },
    { width: 10 },
    ...questions.map(() => ({ width: 4.5 })),
    { width: 7 },
    { width: 8 },
    { width: 9 },
    { width: 9 },
    { width: 10 },
    { width: 10 },
    { width: 17 },
  ];
  const header = sheet.getRow(headerRow);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.height = 22;
  header.eachCell((c) => (c.fill = fill(BRAND)));

  const students = [...list].sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  const correctByQuestion = new Map<number, { ok: number; n: number }>();
  students.forEach((s, i) => {
    const row = sheet.addRow([i + 1, s.fullName, s.groups]);
    row.font = { size: 10 };
    let correct = 0;
    questions.forEach((q, j) => {
      const cell = row.getCell(4 + j);
      cell.alignment = { horizontal: "center" };
      if (!s.attemptId || s.scoreOutOf20 === null) return;
      const c = cells.get(`${s.attemptId}:${q.number}`);
      if (!c) return;
      cell.value = c.value;
      if (c.fill) cell.fill = fill(c.fill);
      const stat = correctByQuestion.get(q.number) ?? { ok: 0, n: 0 };
      if (c.value !== "N") stat.n += 1;
      if (c.value === 1) {
        stat.ok += 1;
        correct += 1;
      }
      correctByQuestion.set(q.number, stat);
    });
    const base = 4 + qCols;
    const graded = s.scoreOutOf20 !== null;
    row.getCell(base).value = graded ? correct : null;
    row.getCell(base + 1).value = graded ? Math.max(0, s.answered - s.correct) : null;
    row.getCell(base + 2).value = graded ? Math.max(0, s.total - s.answered) : null;
    row.getCell(base + 3).value = s.scoreOutOf20;
    row.getCell(base + 3).numFmt = "0.00";
    row.getCell(base + 3).font = { bold: true, size: 10 };
    row.getCell(base + 5).value = minutes(s.durationSec);
    row.getCell(base + 5).numFmt = "0.0";
    row.getCell(base + 6).value = s.submittedAt ? date(s.submittedAt) : null;
    row.getCell(base + 4).value =
      s.status === "ABSENT"
        ? "Absent"
        : !graded
          ? RESULT_STATUS_LABELS[s.status]
          : s.scoreOutOf20! >= 10
            ? "Réussi"
            : "Échoué";
    for (let k = base; k <= base + 5; k++) row.getCell(k).alignment = { horizontal: "center" };
    if (s.status === "ABSENT") row.font = { size: 10, color: { argb: "FF94A3B8" } };
  });

  // Ligne de synthèse : taux de réussite par question
  const footer = sheet.addRow(["", "Réussite par question", ""]);
  footer.font = { bold: true, size: 10 };
  questions.forEach((q, j) => {
    const stat = correctByQuestion.get(q.number);
    const cell = footer.getCell(4 + j);
    cell.value = stat && stat.n > 0 ? Math.round((stat.ok / stat.n) * 100) / 100 : null;
    cell.numFmt = "0%";
    cell.alignment = { horizontal: "center" };
    cell.font = { size: 8, bold: true };
  });
  footer.getCell(4 + qCols + 3).value = summary.mean;
  footer.getCell(4 + qCols + 3).numFmt = "0.00";
  footer.eachCell((c) => (c.fill = fill(GREY_BG)));

  // Bordures fines sur le tableau
  for (let r = headerRow; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= totalCols; c++) {
      sheet.getCell(r, c).border = {
        top: { style: "thin", color: { argb: "FFD9DDE8" } },
        bottom: { style: "thin", color: { argb: "FFD9DDE8" } },
        left: { style: "thin", color: { argb: "FFD9DDE8" } },
        right: { style: "thin", color: { argb: "FFD9DDE8" } },
      };
    }
  }
  sheet.views = [{ state: "frozen", ySplit: headerRow, xSplit: 2 }];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + students.length, column: totalCols },
  };
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  sheet.addRow([]);
  sheet.addRow(["", "1 juste · 0 faux · – sans réponse · X invalidée · N neutralisée"]).font = {
    italic: true,
    size: 9,
    color: { argb: "FF586380" },
  };
  sheet.addRow([]);
  const sig = sheet.addRow(["", "Signature du formateur :"]);
  sig.font = { bold: true, size: 10 };
  sig.height = 40;
  sig.alignment = { vertical: "top" };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
