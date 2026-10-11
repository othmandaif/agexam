import { Card } from "@/components/ui/card";

interface PlannedScreenProps {
  /** Fonctionnalités prévues pour cet écran (issues de la maquette). */
  features: string[];
}

/** Bloc temporaire : liste ce qui sera développé sur l'écran. */
export function PlannedScreen({ features }: PlannedScreenProps) {
  return (
    <Card className="border-dashed p-6">
      <p className="mb-3 text-[13px] font-bold tracking-wide text-muted">À DÉVELOPPER</p>
      <ul className="flex flex-col gap-2 text-[15px] text-ink-soft">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
    </Card>
  );
}
