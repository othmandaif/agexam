import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TONES = {
  blue: "bg-lilac text-primary",
  green: "bg-success-bg text-[#18b981]",
  violet: "bg-violet-bg text-violet",
  orange: "bg-orange-bg text-orange",
} as const;

/** Carte chiffre clé : icône colorée, valeur, libellé, lien optionnel. */
export function StatCard({
  icon,
  value,
  label,
  tone = "blue",
  href,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone?: keyof typeof TONES;
  href?: Route;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:size-[22px]",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[26px] leading-tight font-bold text-ink tabular-nums">{value}</span>
        <span className="truncate text-[13px] text-muted">{label}</span>
      </span>
      {href ? (
        <ChevronRight
          className="size-5 text-faint transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls =
    "group flex items-center gap-4 rounded-card border border-line bg-surface px-5 py-5 shadow-soft transition-shadow duration-150";
  return href ? (
    <Link href={href} className={cn(cls, "text-ink no-underline hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
