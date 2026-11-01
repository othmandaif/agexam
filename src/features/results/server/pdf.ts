import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PASS_MARK } from "@/domain/statistics";
import { formatDateTime } from "@/lib/datetime";
import { fmtScore, RESULT_STATUS_LABELS } from "../labels";
import type { ExamResults, ResultStudent, StudentCopy } from "../types";
import { officialLogo, type ExportMeta } from "./export-meta";

type Doc = PDFKit.PDFDocument;

const C = {
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  soft: "#F1F5F9",
  primary: "#315BEF",
  navy: "#0D2148",
  success: "#0E9F6E",
  successBg: "#DDFBEC",
  danger: "#DC2626",
  dangerBg: "#FFE4E4",
  warning: "#B45309",
  neutralBg: "#EEF0F5",
};

const FONT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "assets", "fonts");

/** Police Unicode embarquée (accents, ✓ ✗, ≥…), Helvetica en secours. */
function registerFonts(doc: Doc) {
  const f = (n: string) => path.join(FONT_DIR, n);
  if (existsSync(f("DejaVuSans.ttf")) && existsSync(f("DejaVuSans-Bold.ttf"))) {
    doc.registerFont("body", f("DejaVuSans.ttf"));
    doc.registerFont("bold", f("DejaVuSans-Bold.ttf"));
    doc.registerFont(
      "mono",
      existsSync(f("DejaVuSansMono.ttf")) ? f("DejaVuSansMono.ttf") : f("DejaVuSans.ttf"),
    );
    return true;
  }
  doc.registerFont("body", "Helvetica");
  doc.registerFont("bold", "Helvetica-Bold");
  doc.registerFont("mono", "Courier");
  return false;
}

function newDoc(layout: "portrait" | "landscape", title: string) {
  const doc = new PDFDocument({
    size: "A4",
    layout,
    margins: { top: 36, bottom: 48, left: 36, right: 36 },
    bufferPages: true,
    info: { Title: title },
  });
  const unicode = registerFonts(doc);
  doc.font("body");
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, done, unicode };
}

const contentWidth = (doc: Doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const bottomLimit = (doc: Doc) => doc.page.height - doc.page.margins.bottom;

/** En-tête officiel : logo OFPPT (ou sigle), établissement, titre, infos de l'épreuve. */
function drawHeader(doc: Doc, meta: ExportMeta, kind: string, title: string) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const width = contentWidth(doc);
  const logo = officialLogo();
  if (logo) {
    doc.image(logo.buf, left, top, { fit: [110, 46] });
  } else {
    doc.roundedRect(left, top + 4, 70, 36, 6).fill(C.navy);
    doc
      .font("bold")
      .fontSize(15)
      .fillColor("#FFFFFF")
      .text("OFPPT", left, top + 14, {
        width: 70,
        align: "center",
      });
  }
  doc
    .font("bold")
    .fontSize(10)
    .fillColor(C.muted)
    .text(meta.establishment.toUpperCase(), left + 130, top + 2, {
      width: width - 260,
      align: "center",
    });
  doc
    .font("bold")
    .fontSize(15)
    .fillColor(C.ink)
    .text(kind, left + 130, doc.y + 2, { width: width - 260, align: "center" });
  doc
    .font("body")
    .fontSize(10.5)
    .fillColor(C.ink)
    .text(title, left + 130, doc.y + 1, { width: width - 260, align: "center" });

  let y = Math.max(doc.y, top + 50) + 10;
  // Largeurs pondérées : la date est courte, le module et le formateur plus longs.
  const cells: [string, string, number][] = [
    ["Module", meta.module ?? "—", 1.2],
    ["Groupe(s)", meta.groups || "—", 0.95],
    ["Date", meta.date || "—", 1],
    ["Formateur", meta.trainer ?? "—", 1.2],
  ];
  const unit = width / cells.reduce((sum, c) => sum + c[2], 0);
  doc.roundedRect(left, y, width, 34, 6).fill(C.soft);
  let cx = left;
  cells.forEach(([label, value, weight]) => {
    const cw = weight * unit;
    const x = cx + 10;
    cx += cw;
    doc
      .font("body")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(label.toUpperCase(), x, y + 6, {
        width: cw - 20,
      });
    doc
      .font("bold")
      .fontSize(9)
      .fillColor(C.ink)
      .text(value, x, y + 17, {
        width: cw - 20,
        height: 11,
        ellipsis: true,
      });
  });
  y += 46;
  doc.x = left;
  doc.y = y;
}

/** Numéros de page et date d'édition en pied de chaque page. */
function drawFooters(doc: Doc, label: string) {
  const range = doc.bufferedPageRange();
  const printed = `Édité le ${formatDateTime(new Date())}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // écrire dans la marge sans créer de page
    const y = doc.page.height - 30;
    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    doc.font("body").fontSize(7.5).fillColor(C.muted);
    doc.text(`${label} · ${printed}`, left, y, { width: width / 2, lineBreak: false });
    doc.text(`Page ${i + 1} / ${range.count}`, left + width / 2, y, {
      width: width / 2,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottom;
  }
}

const statusOf = (s: ResultStudent) =>
  s.status === "ABSENT"
    ? "Absent"
    : s.scoreOutOf20 === null
      ? RESULT_STATUS_LABELS[s.status]
      : s.scoreOutOf20 >= PASS_MARK
        ? "Réussi"
        : "Échoué";

const durationText = (sec: number | null) => {
  if (sec === null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m >= 60
    ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`
    : `${m} min ${String(s).padStart(2, "0")}`;
};

interface Col {
  label: string;
  width: number;
  align?: "left" | "center" | "right";
}

/**
 * Grille des résultats (A4 paysage, multi-pages, en-tête de tableau répété,
 * numéros de page, zone de signature).
 */
export async function buildResultsPdf(
  results: ExamResults,
  meta: ExportMeta,
  students: ResultStudent[],
  filterLabel: string | null,
): Promise<Buffer> {
  const { doc, done } = newDoc("landscape", `Résultats · ${results.exam.title}`);
  drawHeader(doc, meta, "Grille des résultats", results.exam.title);

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const cols: Col[] = [
    { label: "N°", width: 30, align: "center" },
    { label: "Nom et prénom", width: 196 },
    { label: "Groupe", width: 84 },
    { label: "Note /20", width: 60, align: "right" },
    { label: "Statut", width: 70, align: "center" },
    { label: "Justes", width: 48, align: "center" },
    { label: "Fausses", width: 52, align: "center" },
    { label: "Sans rép.", width: 58, align: "center" },
    { label: "Durée", width: 62, align: "center" },
    { label: "Remise", width: 0 },
  ];
  cols[cols.length - 1]!.width = width - cols.reduce((s, c) => s + c.width, 0);

  const { summary } = results;
  doc
    .font("body")
    .fontSize(8.5)
    .fillColor(C.muted)
    .text(
      [
        `${students.length} étudiant${students.length > 1 ? "s" : ""}${filterLabel ? ` (filtre : ${filterLabel})` : ""}`,
        `${summary.submitted}/${summary.enrolled} copies notées`,
        summary.mean !== null ? `moyenne ${fmtScore(summary.mean)}/20` : null,
        summary.passRate !== null ? `réussite ${Math.round(summary.passRate * 100)} %` : null,
        results.exam.bonusPoints > 0
          ? `bonus de classe +${fmtScore(results.exam.bonusPoints)}`
          : null,
      ]
        .filter(Boolean)
        .join("  ·  "),
      left,
      doc.y,
    );
  doc.moveDown(0.6);

  const rowH = 18;
  const headH = 22;
  const drawHead = () => {
    let x = left;
    const y = doc.y;
    doc.rect(left, y, width, headH).fill(C.navy);
    doc.font("bold").fontSize(8).fillColor("#FFFFFF");
    for (const c of cols) {
      doc.text(c.label, x + 5, y + 7, {
        width: c.width - 10,
        align: c.align ?? "left",
        lineBreak: false,
      });
      x += c.width;
    }
    doc.y = y + headH;
  };
  drawHead();

  students.forEach((s, i) => {
    if (doc.y + rowH > bottomLimit(doc)) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(left, y, width, rowH).fill("#F8FAFC");
    const graded = s.scoreOutOf20 !== null;
    const status = statusOf(s);
    const values = [
      String(i + 1),
      s.fullName,
      s.groups,
      graded ? fmtScore(s.scoreOutOf20) : "—",
      status,
      graded ? String(s.correct) : "",
      graded ? String(Math.max(0, s.answered - s.correct)) : "",
      graded ? String(Math.max(0, s.total - s.answered)) : "",
      durationText(s.durationSec),
      s.submittedAt ? formatDateTime(new Date(s.submittedAt)) : "",
    ];
    let x = left;
    values.forEach((v, j) => {
      const c = cols[j]!;
      const isNote = j === 3;
      const isStatus = j === 4;
      doc
        .font(isNote || j === 1 ? "bold" : "body")
        .fontSize(8.5)
        .fillColor(
          s.status === "ABSENT"
            ? C.muted
            : isStatus || isNote
              ? status === "Réussi"
                ? C.success
                : status === "Échoué"
                  ? C.danger
                  : C.ink
              : C.ink,
        )
        .text(v, x + 5, y + 5, {
          width: c.width - 10,
          align: c.align ?? "left",
          height: 11,
          ellipsis: true,
        });
      x += c.width;
    });
    doc
      .moveTo(left, y + rowH)
      .lineTo(left + width, y + rowH)
      .lineWidth(0.5)
      .strokeColor(C.line)
      .stroke();
    doc.y = y + rowH;
  });

  // Zone de signature du formateur
  const sigH = 78;
  if (doc.y + sigH + 16 > bottomLimit(doc)) doc.addPage();
  const sy = doc.y + 18;
  const boxW = 240;
  const sx = left + width - boxW;
  doc.roundedRect(sx, sy, boxW, sigH, 6).lineWidth(0.8).strokeColor(C.line).stroke();
  doc
    .font("bold")
    .fontSize(8.5)
    .fillColor(C.ink)
    .text("Le formateur", sx + 10, sy + 8, {
      width: boxW - 20,
    });
  if (meta.trainer) {
    doc
      .font("body")
      .fontSize(8)
      .fillColor(C.muted)
      .text(meta.trainer, sx + 10, sy + 21, {
        width: boxW - 20,
      });
  }
  doc
    .font("body")
    .fontSize(7.5)
    .fillColor(C.muted)
    .text("Signature", sx + 10, sy + sigH - 16, {
      width: boxW - 20,
    });
  doc
    .font("body")
    .fontSize(8)
    .fillColor(C.muted)
    .text(
      `Seuil de réussite : ${PASS_MARK}/20. Fausses = réponses données incorrectes ; Sans rép. = questions sans réponse.`,
      left,
      sy + 4,
      { width: width - boxW - 24 },
    );

  drawFooters(doc, results.exam.title);
  doc.end();
  return done;
}

const letter = (i: number) => String.fromCharCode(65 + i);

/**
 * Copie individuelle (A4 portrait) : chaque question avec ses choix, la réponse
 * de l'étudiant, la bonne réponse, le résultat et les points. Réservé au personnel.
 */
export async function buildCopyPdf(
  copy: StudentCopy,
  meta: ExportMeta,
  groups: string,
  bonusPoints: number,
): Promise<Buffer> {
  const { doc, done, unicode } = newDoc("portrait", `Copie · ${copy.student.fullName}`);
  const OK = unicode ? "✓" : "V";
  const KO = unicode ? "✗" : "X";
  drawHeader(doc, meta, "Copie individuelle", copy.examTitle);
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  const rows = [...copy.questions].sort((a, b) => a.number - b.number);
  const countable = rows.filter((q) => !q.examNeutralized && q.status !== "NEUTRALISEE");
  const correct = countable.filter((q) => q.isCorrect === true).length;
  const graded = copy.scoreOutOf20 !== null;
  const passed = graded && copy.scoreOutOf20! >= PASS_MARK;

  // Bloc étudiant
  const y0 = doc.y;
  doc.roundedRect(left, y0, width, 62, 8).lineWidth(0.8).strokeColor(C.line).stroke();
  doc
    .font("bold")
    .fontSize(13)
    .fillColor(C.ink)
    .text(copy.student.fullName, left + 14, y0 + 23, {
      width: width - 160,
      height: 18,
      ellipsis: true,
    });
  const bx = left + width - 132;
  doc
    .roundedRect(bx, y0 + 9, 120, 44, 8)
    .fill(graded ? (passed ? C.successBg : C.dangerBg) : C.neutralBg);
  doc
    .font("bold")
    .fontSize(18)
    .fillColor(graded ? (passed ? C.success : C.danger) : C.muted)
    .text(graded ? `${fmtScore(copy.scoreOutOf20)}/20` : "—", bx, y0 + 14, {
      width: 120,
      align: "center",
    });
  doc
    .font("bold")
    .fontSize(8)
    .text(graded ? (passed ? "RÉUSSI" : "ÉCHOUÉ") : "NON NOTÉE", bx, y0 + 37, {
      width: 120,
      align: "center",
    });
  doc.y = y0 + 76;

  for (const q of rows) {
    const neutralized = q.examNeutralized || q.status === "NEUTRALISEE";
    const isBlank = q.algo ? !q.algo.code?.trim() : q.selectedOptionIds.length === 0;
    // Algorithme : on imprime le code de l'étudiant et la correction.
    const codeText = q.algo ? q.algo.code?.trim() || null : q.code;
    const g = q.algo?.grading;
    const gradeNote = q.algo
      ? g?.status === "done"
        ? `Correction${g.source === "manual" ? " du formateur" : " automatique"}${
            g.testsTotal ? ` : ${g.testsPassed}/${g.testsTotal} jeux d'essai réussis` : ""
          }.${g.comment ? ` ${g.comment}` : ""}`
        : isBlank
          ? ""
          : "Correction en cours."
      : "";
    const state = neutralized
      ? { text: "Neutralisée", color: C.muted, bg: C.neutralBg }
      : q.status === "INVALIDEE"
        ? { text: "Invalidée", color: C.danger, bg: C.dangerBg }
        : isBlank
          ? { text: "Sans réponse", color: C.warning, bg: "#FEF3C7" }
          : q.isCorrect
            ? { text: "Correcte", color: C.success, bg: C.successBg }
            : (q.pointsAwarded ?? 0) > 0
              ? { text: "Partielle", color: C.warning, bg: "#FEF3C7" }
              : { text: "Incorrecte", color: C.danger, bg: C.dangerBg };

    const textW = width - 24;
    doc.font("bold").fontSize(9.5);
    const promptH = doc.heightOfString(`${q.number}. ${q.prompt}`, { width: textW - 130 });
    doc.font("mono").fontSize(8);
    const codeH = codeText ? doc.heightOfString(codeText, { width: textW - 16 }) + 12 : 0;
    doc.font("body").fontSize(9);
    const optH = q.options.reduce(
      (s, o) => s + Math.max(14, doc.heightOfString(o.label, { width: textW - 70 }) + 4),
      0,
    );
    const noteH = gradeNote ? doc.heightOfString(gradeNote, { width: textW }) + 6 : 0;
    const blockH = 14 + promptH + 6 + codeH + optH + noteH + 8;
    if (doc.y + blockH > bottomLimit(doc) && blockH < bottomLimit(doc) - doc.page.margins.top) {
      doc.addPage();
    }
    const by = doc.y;
    doc.roundedRect(left, by, width, blockH, 6).lineWidth(0.6).strokeColor(C.line).stroke();
    doc
      .font("bold")
      .fontSize(9.5)
      .fillColor(C.ink)
      .text(`${q.number}. ${q.prompt}`, left + 12, by + 10, {
        width: textW - 130,
      });
    // Résultat et points
    doc.roundedRect(left + width - 128, by + 8, 70, 16, 8).fill(state.bg);
    doc
      .font("bold")
      .fontSize(7.5)
      .fillColor(state.color)
      .text(state.text, left + width - 128, by + 12.5, {
        width: 70,
        align: "center",
      });
    doc
      .font("bold")
      .fontSize(9)
      .fillColor(C.ink)
      .text(
        q.pointsAwarded === null
          ? `—/${fmtScore(q.points)}`
          : `${fmtScore(q.pointsAwarded)}/${fmtScore(q.points)}`,
        left + width - 56,
        by + 11.5,
        { width: 46, align: "right" },
      );
    let y = by + 10 + promptH + 6;
    if (codeText) {
      doc.roundedRect(left + 12, y, textW, codeH - 4, 4).fill(C.soft);
      doc
        .font("mono")
        .fontSize(8)
        .fillColor(C.ink)
        .text(codeText, left + 20, y + 4, { width: textW - 16 });
      y += codeH;
    }
    if (gradeNote) {
      doc
        .font("body")
        .fontSize(9)
        .fillColor(C.muted)
        .text(gradeNote, left + 12, y + 2, { width: textW });
      y += noteH;
    }
    q.options.forEach((o, i) => {
      const selected = q.selectedOptionIds.includes(o.id);
      doc.font("body").fontSize(9);
      const h = Math.max(14, doc.heightOfString(o.label, { width: textW - 70 }) + 4);
      if (selected) {
        doc
          .roundedRect(left + 10, y - 1, textW + 4, h, 4)
          .fill(o.isCorrect ? C.successBg : C.dangerBg);
      }
      doc
        .font(selected ? "bold" : "body")
        .fontSize(9)
        .fillColor(C.ink)
        .text(`${letter(i)}.`, left + 16, y + 2, { width: 16 })
        .text(o.label, left + 34, y + 2, { width: textW - 70 });
      const tag = [
        o.isCorrect ? `${OK} bonne` : null,
        selected ? (o.isCorrect ? "choisie" : `${KO} choisie`) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (tag) {
        doc
          .font("bold")
          .fontSize(7.5)
          .fillColor(o.isCorrect ? C.success : C.danger)
          .text(tag, left + width - 96, y + 3, { width: 82, align: "right" });
      }
      y += h;
    });
    doc.y = by + blockH + 8;
  }

  // Totaux
  if (doc.y + 70 > bottomLimit(doc)) doc.addPage();
  const ty = doc.y + 4;
  doc.roundedRect(left, ty, width, 54, 8).fill(C.soft);
  doc
    .font("bold")
    .fontSize(10)
    .fillColor(C.ink)
    .text("Total", left + 14, ty + 10)
    .font("body")
    .fontSize(9)
    .text(
      [
        copy.scoreAwarded !== null && copy.scoreMax !== null
          ? `${fmtScore(copy.scoreAwarded)} / ${fmtScore(copy.scoreMax)} points`
          : null,
        `${correct}/${countable.length} justes`,
        bonusPoints > 0 ? `bonus de classe +${fmtScore(bonusPoints)} inclus` : null,
        copy.neutralizations > 0 ? `${copy.neutralizations} question(s) neutralisée(s)` : null,
      ]
        .filter(Boolean)
        .join("  ·  "),
      left + 14,
      ty + 28,
      { width: width - 170 },
    );
  doc
    .font("bold")
    .fontSize(16)
    .fillColor(graded ? (passed ? C.success : C.danger) : C.muted)
    .text(
      graded ? `Note finale : ${fmtScore(copy.scoreOutOf20)}/20` : "Non notée",
      left + width - 220,
      ty + 18,
      {
        width: 206,
        align: "right",
      },
    );

  drawFooters(doc, `${copy.student.fullName} · ${copy.examTitle}`);
  doc.end();
  return done;
}
