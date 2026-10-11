"use client";

import { Check, CircleAlert, LoaderCircle, Maximize, Monitor, Wifi, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration, formatTotalDuration } from "@/domain/duration";
import type { SanctionType } from "@/domain/enums";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { startAttemptAction } from "../server/actions";
import { attemptApi } from "./api";

type CheckStatus = "pending" | "ok" | "fail";

interface CheckItem {
  key: string;
  label: string;
  detail: string;
  status: CheckStatus;
}

const SANCTION_LABEL: Record<SanctionType, string> = {
  AUCUNE: "enregistrée",
  AVERTISSEMENT: "avertissement",
  PENALITE: "pénalité",
  INVALIDER_QUESTION: "question en cours invalidée",
  SOUMISSION_AUTO: "soumission automatique",
};

interface PreparationPanelProps {
  examId: string;
  questionCount: number;
  minDurationSec: number;
  maxDurationSec: number;
  /** Chrono global : durée de tout l'examen (sinon null). */
  globalDurationSec?: number | null;
  violationPolicy: SanctionType[];
  /** Tentative en cours à reprendre (pas besoin du code). */
  resumeAttemptId: string | null;
  initialCode: string;
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;

async function runChecks(): Promise<CheckItem[]> {
  const isDesktop = !MOBILE_UA.test(navigator.userAgent) && window.screen.width >= 1024;
  const modern =
    typeof document.documentElement.requestFullscreen === "function" && "randomUUID" in crypto;
  let latency: number | null = null;
  try {
    const t0 = performance.now();
    await attemptApi.serverTime();
    latency = Math.round(performance.now() - t0);
  } catch {
    latency = null;
  }
  return [
    {
      key: "device",
      label: "Écran d'ordinateur",
      detail: isDesktop
        ? `${window.screen.width} × ${window.screen.height}`
        : "Utilisez un ordinateur (pas de téléphone ni de tablette).",
      status: isDesktop ? "ok" : "fail",
    },
    {
      key: "browser",
      label: "Navigateur compatible",
      detail: modern ? "Chrome, Edge ou Firefox récent" : "Mettez à jour votre navigateur.",
      status: modern ? "ok" : "fail",
    },
    {
      key: "fullscreen",
      label: "Plein écran disponible",
      detail: document.fullscreenEnabled
        ? "Autorisé"
        : "Le plein écran est bloqué par le navigateur.",
      status: document.fullscreenEnabled ? "ok" : "fail",
    },
    {
      key: "network",
      label: "Connexion au serveur",
      detail: latency === null ? "Serveur injoignable." : `Latence ${latency} ms`,
      status: latency !== null && latency < 3000 ? "ok" : "fail",
    },
  ];
}

const ICONS = { device: Monitor, browser: Check, fullscreen: Maximize, network: Wifi } as const;

export function PreparationPanel(props: PreparationPanelProps) {
  const router = useRouter();
  const [checks, setChecks] = useState<CheckItem[] | null>(null);
  const [code, setCode] = useState(props.initialCode);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const resume = !!props.resumeAttemptId;

  useEffect(() => {
    let cancelled = false;
    runChecks().then((result) => {
      if (!cancelled) setChecks(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allOk = !!checks && checks.every((c) => c.status === "ok");
  const codeOk = resume || /^[A-Z0-9]{6}$/.test(code);
  const canStart = allOk && codeOk && (accepted || resume) && !pending;

  const start = async () => {
    setError(null);
    // Le plein écran doit être demandé directement par le clic.
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError("Le plein écran a été refusé. Autorisez-le puis réessayez.");
      return;
    }
    const formData = new FormData();
    formData.set("examId", props.examId);
    if (resume) formData.set("resume", "1");
    else formData.set("accessCode", code);

    startTransition(async () => {
      const result = await startAttemptAction(IDLE, formData);
      if (result.status === "success" && result.data) {
        router.push(`/examen/${result.data.attemptId}` as Route);
      } else {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        setError(result.status === "error" ? result.message : "Démarrage impossible.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-stretch gap-6">
        <Card className="flex-[1_1_360px]">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Vérification technique</CardTitle>
            {checks ? (
              <span
                className={cn(
                  "inline-flex h-6.5 items-center rounded-full px-2.5 text-[13px] font-bold",
                  allOk ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
                )}
              >
                {checks.filter((c) => c.status === "ok").length} / {checks.length} OK
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {!checks ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Vérification en cours…
              </p>
            ) : (
              <ul>
                {checks.map((c) => {
                  const Icon = ICONS[c.key as keyof typeof ICONS] ?? Check;
                  return (
                    <li
                      key={c.key}
                      className="flex items-center gap-4 border-b border-line-soft py-3.5 last:border-b-0"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          c.status === "ok"
                            ? "bg-success-bg text-success"
                            : "bg-danger-bg text-danger",
                        )}
                      >
                        {c.status === "ok" ? (
                          <Check className="size-4.5" strokeWidth={2.6} aria-hidden />
                        ) : (
                          <X className="size-4.5" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-bold">
                          <Icon className="size-4 text-muted" aria-hidden /> {c.label}
                        </div>
                        <div className="text-sm text-muted">{c.detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 flex gap-3 rounded-xl bg-warning-bg px-4 py-3 text-sm leading-relaxed text-[#7a3b00]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Fermez les autres applications et désactivez les notifications : une fenêtre qui
              s&apos;ouvre peut compter comme une sortie du mode examen.
            </p>
          </CardContent>
        </Card>

        <Card className="flex-[1.3_1_440px]">
          <CardHeader>
            <CardTitle>Règles de l&apos;examen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Stat value={String(props.questionCount)} label="questions" />
              {props.globalDurationSec ? (
                <Stat value={formatTotalDuration(props.globalDurationSec)} label="au total" />
              ) : (
                <Stat
                  value={
                    props.minDurationSec === props.maxDurationSec
                      ? formatDuration(props.minDurationSec)
                      : `${formatDuration(props.minDurationSec)} – ${formatDuration(props.maxDurationSec)}`
                  }
                  label="par question"
                />
              )}
              <Stat value="1" label="tentative" />
            </div>
            <Rule n={1}>
              {props.globalDurationSec
                ? "Un seul chrono pour tout l'examen. Gérez votre temps : à la fin du chrono, l'examen est remis avec les réponses déjà validées."
                : "Chaque question a son propre temps. À la fin du temps, on passe automatiquement à la suivante."}
            </Rule>
            <Rule n={2}>
              <strong>Pas de retour en arrière.</strong> Une question validée ou expirée ne peut
              plus être modifiée.
            </Rule>
            <Rule n={3}>
              Chaque clic est enregistré tout de suite. Si la page se recharge, vous reprenez au
              même endroit.
            </Rule>
            <Rule n={4}>
              Le plein écran est obligatoire. Sorties du mode examen, comptées{" "}
              <strong>par question</strong> :{" "}
              {props.violationPolicy
                .slice(0, 2)
                .map((s, i) => `${i === 0 ? "1re" : "2e"} → ${SANCTION_LABEL[s]}`)
                .join(", ")}
              . Le compteur repart à zéro à chaque question. Un seul onglet ou appareil à la fois.
            </Rule>
            {!resume ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-lilac p-4 text-[15px] font-semibold">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                J&apos;ai lu les règles et j&apos;accepte que mes actions pendant l&apos;examen
                soient enregistrées.
              </label>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-4">
        {!resume ? (
          <div className="flex flex-col items-center gap-2">
            <Label htmlFor="access-code">Code d&apos;accès affiché par le formateur</Label>
            <Input
              id="access-code"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6),
                )
              }
              autoComplete="off"
              spellCheck={false}
              placeholder="K7M4Q2"
              className="h-14 w-64 text-center font-mono text-2xl font-bold tracking-[0.3em]"
              aria-invalid={code.length > 0 && !codeOk ? true : undefined}
            />
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger"
          >
            <CircleAlert className="size-4" aria-hidden /> {error}
          </p>
        ) : null}
        <Button size="lg" variant="mint" disabled={!canStart} onClick={start}>
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Maximize aria-hidden />
          )}
          {resume ? "Reprendre en plein écran" : "Passer en plein écran et démarrer"}
        </Button>
        <p className="text-sm text-muted">
          {resume
            ? "Votre tentative continue là où elle s'est arrêtée. Le chrono n'a pas été mis en pause."
            : props.globalDurationSec
              ? "Le chrono de l'examen démarre quand la première question s'affiche."
              : "Le chrono de la première question démarre quand elle s'affiche."}
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-[1_1_120px] rounded-xl bg-canvas px-4 py-3.5">
      <div className="font-display text-[22px] font-bold">{value}</div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  );
}

function Rule({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 text-[15px] leading-relaxed text-ink-soft">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-lilac text-[13px] font-extrabold text-primary-strong">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}
