"use client";

import { CalendarRange, History, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { startNavProgress } from "@/components/navigation/nav-progress";
import { academicYearLabel } from "@/domain/academic-year";
import { cn } from "@/lib/utils";
import { setViewYearAction } from "@/server/year/actions";

/** Sélecteur d'année scolaire (barre du haut) : l'année courante par défaut. */
export function YearSwitcher({
  years,
  viewYear,
  currentYear,
}: {
  years: string[];
  viewYear: string;
  currentYear: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const past = viewYear !== currentYear;
  const change = (year: string) =>
    start(async () => {
      startNavProgress();
      await setViewYearAction(year);
      router.refresh();
    });

  return (
    <label
      className={cn(
        "relative flex h-11 items-center gap-2 rounded-[12px] border pr-2 pl-3 text-[13.5px] font-semibold transition-colors duration-150",
        past
          ? "border-warning-fill/50 bg-warning-bg text-warning"
          : "border-line bg-surface text-ink hover:bg-canvas",
      )}
      title="Année scolaire affichée"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : past ? (
        <History className="size-4" aria-hidden />
      ) : (
        <CalendarRange className="size-4 text-primary" aria-hidden />
      )}
      <span className="sr-only">Année scolaire</span>
      <select
        value={viewYear}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {academicYearLabel(y)}
            {y === currentYear ? " (en cours)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Bandeau des années passées : consultation seule, retour à l'année courante. */
export function PastYearBanner({
  viewYear,
  currentYear,
}: {
  viewYear: string;
  currentYear: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-fill/40 bg-warning-bg px-8 py-2.5 text-[13.5px] text-warning max-sm:px-4"
    >
      <span className="flex items-center gap-2 font-semibold">
        <History className="size-4" aria-hidden />
        Année {academicYearLabel(viewYear)} : consultation seule (examens, résultats, exports).
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            startNavProgress();
            await setViewYearAction(currentYear);
            router.refresh();
          })
        }
        className="rounded-[8px] px-2.5 py-1 font-bold underline-offset-2 transition-colors duration-150 hover:bg-white/60 hover:underline"
      >
        Revenir à {academicYearLabel(currentYear)}
      </button>
    </div>
  );
}
