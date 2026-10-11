import { CheckCircle2, ChevronRight, Clock, FileCheck2, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPercent, fmtScore } from "../labels";
import type { ExamResults } from "../types";

const TONES = {
  blue: "bg-lilac text-primary",
  green: "bg-success-bg text-[#18b981]",
  violet: "bg-violet-bg text-violet",
  orange: "bg-orange-bg text-orange",
} as const;

/** En-tête de la page résultats : 4 chiffres clés, anneau de réussite, verdict. */
export function ResultsSummary({ results }: { results: Pick<ExamResults, "summary"> }) {
  const { summary } = results;
  const avgMin = summary.avgDurationSec === null ? null : Math.round(summary.avgDurationSec / 60);
  const participation = summary.enrolled ? summary.submitted / summary.enrolled : null;
  const rate = summary.passRate;

  const verdict =
    rate === null
      ? null
      : rate >= 0.7
        ? {
            title: "Bonne performance",
            text: "La majorité du groupe maîtrise le contenu.",
            tone: "success",
          }
        : rate >= 0.5
          ? {
              title: "Résultats corrects",
              text: "Quelques notions sont à consolider.",
              tone: "warning",
            }
          : {
              title: "À retravailler",
              text: "Moins de la moitié du groupe a réussi.",
              tone: "danger",
            };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={<FileCheck2 />}
          tone="blue"
          label="Copies notées"
          value={`${summary.submitted}/${summary.enrolled}`}
          chip={participation === null ? null : fmtPercent(participation)}
        />
        <Kpi
          icon={<Target />}
          tone="violet"
          label="Note moyenne"
          value={summary.mean === null ? "—" : `${fmtScore(summary.mean)}/20`}
          chip={summary.median === null ? null : `méd. ${fmtScore(summary.median)}`}
        />
        <Kpi
          icon={<TrendingUp />}
          tone="green"
          label="Taux de réussite"
          value={fmtPercent(rate)}
          chip="≥ 10"
        />
        <Kpi
          icon={<Clock />}
          tone="orange"
          label="Durée moyenne"
          value={avgMin === null ? "—" : avgMin < 1 ? "< 1 min" : `${avgMin} min`}
          chip={summary.flagged ? `${summary.flagged} à revoir` : null}
        />
      </div>

      <div className="flex items-center gap-5 rounded-card border border-line bg-surface p-5 shadow-soft">
        <Ring value={rate} />
        <div className="flex min-w-0 flex-col gap-1.5">
          {verdict ? (
            <>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                  verdict.tone === "success" && "bg-success-bg text-success",
                  verdict.tone === "warning" && "bg-warning-bg text-warning",
                  verdict.tone === "danger" && "bg-danger-bg text-danger",
                )}
              >
                <CheckCircle2 className="size-3.5" aria-hidden /> {verdict.title}
              </span>
              <p className="text-[13.5px] text-muted">{verdict.text}</p>
              <a
                href="#questions"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary no-underline hover:underline"
              >
                Voir le détail des questions <ChevronRight className="size-4" aria-hidden />
              </a>
            </>
          ) : (
            <p className="text-[13.5px] text-muted">Aucune copie notée pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  chip,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  chip: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full [&_svg]:size-5",
            TONES[tone],
          )}
        >
          {icon}
        </span>
        {chip ? (
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11.5px] font-semibold text-muted">
            {chip}
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-[24px] leading-tight font-bold text-ink tabular-nums">{value}</div>
        <div className="text-[13px] text-muted">{label}</div>
      </div>
    </div>
  );
}

function Ring({ value }: { value: number | null }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const color = v >= 0.7 ? "#18b981" : v >= 0.5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#eef2f7" strokeWidth={10} />
        {value !== null ? (
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold tabular-nums">{fmtPercent(value)}</span>
        <span className="text-[11px] text-muted">réussite</span>
      </span>
    </div>
  );
}
