import type { LucideIcon } from "lucide-react";

/**
 * État vide : ce qui est vide, pourquoi, et quoi faire (action principale).
 * `illustration` remplace l'icône par un petit dessin.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {illustration ? (
        <div className="mb-1 w-48 [&_svg]:h-auto [&_svg]:w-full">{illustration}</div>
      ) : Icon ? (
        <span className="flex size-14 items-center justify-center rounded-full bg-lilac text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <p className="text-[19px] font-bold text-ink">{title}</p>
      {description ? <p className="max-w-md text-[14px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
