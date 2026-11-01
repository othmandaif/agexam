import type { AlgoGrading } from "@/domain/algo-grading";
import { fmtScore, VERDICT_LABEL } from "../labels";

/** Détail d'une correction automatique : verdict, commentaire, analyse, critères. */
export function GradingDetails({ grading: g, points }: { grading: AlgoGrading; points: number }) {
  const pts = (r: number) => fmtScore(Math.round(r * points * 100) / 100);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {g.verdict ? <span className="font-bold text-ink">{VERDICT_LABEL[g.verdict]}</span> : null}
        {g.testsTotal ? (
          <span className="text-muted">
            · {g.testsPassed} / {g.testsTotal} jeux d&apos;essai réussis
          </span>
        ) : null}
      </p>
      {g.comment ? <p className="text-ink-soft">{g.comment}</p> : null}
      {g.criteria?.length ? (
        <table className="w-full text-[13px]">
          <caption className="sr-only">Détail de la note par critère</caption>
          <tbody>
            {g.criteria.map((c) => (
              <tr key={c.key} className="border-t border-line-soft align-top">
                <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{c.label}</td>
                <td className="py-1.5 pr-3 text-right font-bold whitespace-nowrap tabular-nums">
                  {pts(c.score)} / {pts(c.max)}
                </td>
                <td className="py-1.5 text-muted">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {g.analysis ? (
        <details className="rounded-field border border-line-soft bg-surface px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-primary">
            Analyse détaillée (visible par vous seul)
          </summary>
          <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-soft">
            {g.analysis.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </details>
      ) : null}
      {g.reviewSource === "bareme" ? (
        <p className="text-xs text-warning">
          Relecture DeepSeek indisponible{g.reviewError ? ` (${g.reviewError})` : ""} : note
          estimée, à vérifier.
        </p>
      ) : null}
    </div>
  );
}
