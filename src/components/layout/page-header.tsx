import { BackLink } from "@/components/navigation/back-link";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /** Icône dans une pastille à gauche du titre. */
  icon?: React.ReactNode;
  /** Bouton retour, toujours au-dessus du titre : destination de repli + libellé. */
  back?: { href: string; label: string };
}

export function PageHeader({ title, description, eyebrow, actions, icon, back }: PageHeaderProps) {
  const row = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {icon ? (
          <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-full bg-lilac text-primary [&_svg]:size-6">
            {icon}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow ? (
            <div className="text-[13px] text-muted [&_a]:text-muted [&_a:hover]:text-primary">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-[26px] leading-tight font-bold text-ink">{title}</h1>
          {description ? <p className="max-w-3xl text-[15px] text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
  if (!back) return row;
  return (
    <div className="flex flex-col gap-3">
      <BackLink href={back.href}>{back.label}</BackLink>
      {row}
    </div>
  );
}
