"use client";

import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  Pencil,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import type { ExamPhase } from "@/domain/exam-lifecycle";
import type { ActionState } from "@/lib/action-state";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { purgeExamAction, removeExamAction, restoreExamAction } from "../server/actions";

export interface ExamRow {
  id: string;
  title: string;
  phase: ExamPhase;
  isPractice: boolean;
  meta: string;
  period: string;
  content: string;
  accessCode: string | null;
  attemptCount: number;
}

/** Tableau des examens (page courante) avec actions de ligne et confirmation. */
export function ExamsTable({
  rows,
  empty,
}: {
  rows: ExamRow[];
  /** Affiché à la place du tableau quand la page est vide (le message reste visible). */
  empty?: React.ReactNode;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<ExamRow | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ExamRow | null>(null);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<ActionState<unknown> | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<ActionState<unknown>>) =>
    start(async () => {
      const res = await action();
      setFlash(res);
      setTarget(null);
      setPurgeTarget(null);
      setTyped("");
      if (res.status === "success") router.refresh();
    });

  return (
    <>
      {flash && flash.status !== "idle" ? (
        <div
          role="status"
          className={cn(
            "animate-fade-in flex items-center gap-2 border-b px-5 py-2.5 text-sm font-semibold",
            flash.status === "success"
              ? "border-[#bfe9d6] bg-success-bg text-success"
              : "border-[#f6caca] bg-danger-bg text-danger",
          )}
        >
          {flash.status === "success" ? <CheckCircle2 className="size-4" aria-hidden /> : null}
          <span className="flex-1">{flash.message}</span>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Fermer le message"
            className="rounded-full p-1 hover:bg-surface"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      {rows.length === 0 ? empty : null}
      <div className={cn("relative overflow-x-auto", rows.length === 0 && "hidden")}>
        <table className={cn("w-full min-w-[860px] text-[14px]", pending && "opacity-60")}>
          <thead>
            <tr className="border-b border-line-soft text-left text-[12px] font-semibold tracking-wide text-muted uppercase">
              <th className="px-5 py-3">Examen</th>
              <th className="px-3 py-3">État</th>
              <th className="px-3 py-3">Période</th>
              <th className="px-3 py-3">Contenu</th>
              <th className="px-3 py-3">Code</th>
              <th className="px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const archived = e.phase === "ARCHIVE";
              const items: RowMenuItem[] = [
                { label: "Ouvrir", icon: FileText, href: paths.exam(e.id) },
                ...(e.phase === "BROUILLON" || e.phase === "PLANIFIE"
                  ? [{ label: "Modifier", icon: Pencil, href: paths.editExam(e.id) }]
                  : []),
                ...(e.phase === "OUVERT"
                  ? [{ label: "Suivi en direct", icon: Radio, href: paths.examMonitor(e.id) }]
                  : []),
                ...(e.attemptCount > 0
                  ? [{ label: "Résultats", icon: BarChart3, href: paths.examResults(e.id) }]
                  : []),
                ...(archived
                  ? [
                      {
                        label: "Restaurer",
                        icon: ArchiveRestore,
                        onSelect: () => run(() => restoreExamAction(e.id)),
                      },
                      {
                        label: "Supprimer définitivement",
                        icon: Trash2,
                        danger: true,
                        onSelect: () => {
                          setTyped("");
                          setPurgeTarget(e);
                        },
                      },
                    ]
                  : [
                      {
                        label: e.attemptCount > 0 ? "Archiver" : "Supprimer",
                        icon: e.attemptCount > 0 ? Archive : Trash2,
                        danger: true,
                        onSelect: () => setTarget(e),
                      },
                    ]),
              ];
              return (
                <tr
                  key={e.id}
                  className="group border-b border-line-soft transition-colors duration-150 last:border-0 hover:bg-[#f8fafc]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={paths.exam(e.id)}
                      className="font-semibold text-ink no-underline transition-colors group-hover:text-primary"
                    >
                      {e.title}
                    </Link>
                    <div className="text-[12.5px] text-muted">{e.meta || "—"}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="inline-flex flex-wrap gap-1.5">
                      <ExamPhaseBadge phase={e.phase} />
                      {e.isPractice ? <Badge tone="info">Entraînement</Badge> : null}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-muted">{e.period}</td>
                  <td className="px-3 py-3.5 text-muted">{e.content}</td>
                  <td className="px-3 py-3.5 font-mono font-bold tracking-wider">
                    {e.accessCode ?? "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <RowMenu label={`Actions pour ${e.title}`} items={items} />
                      <Link
                        href={paths.exam(e.id)}
                        aria-label={`Ouvrir ${e.title}`}
                        className="flex size-8 items-center justify-center rounded-[8px] text-primary transition-colors hover:bg-lilac"
                      >
                        <ChevronRight className="size-5" aria-hidden />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!target}
        danger
        pending={pending}
        title={target?.attemptCount ? "Archiver cet examen ?" : "Supprimer cet examen ?"}
        confirmLabel={target?.attemptCount ? "Archiver" : "Supprimer définitivement"}
        onCancel={() => setTarget(null)}
        onConfirm={() => target && run(() => removeExamAction(target.id))}
      >
        <p>
          <strong className="text-ink">{target?.title}</strong>
        </p>
        {target?.attemptCount ? (
          <p className="mt-2">
            {target.attemptCount} stagiaire{target.attemptCount > 1 ? "s ont" : " a"} déjà passé cet
            examen. Il sera <strong>archivé</strong> : retiré des listes et des statistiques, les
            résultats sont conservés et il pourra être restauré.
          </p>
        ) : (
          <p className="mt-2">Aucun stagiaire ne l&apos;a passé. Cette action est définitive.</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!purgeTarget}
        danger
        pending={pending}
        title="Supprimer définitivement ?"
        confirmLabel="Supprimer tout"
        confirmDisabled={typed.trim().toUpperCase() !== "SUPPRIMER"}
        onCancel={() => {
          setPurgeTarget(null);
          setTyped("");
        }}
        onConfirm={() => purgeTarget && run(() => purgeExamAction(purgeTarget.id))}
      >
        <p>
          <strong className="text-ink">{purgeTarget?.title}</strong>
        </p>
        <p className="mt-2">
          L&apos;examen et{" "}
          <strong className="text-danger">
            {purgeTarget?.attemptCount
              ? `les ${purgeTarget.attemptCount} copie${purgeTarget.attemptCount > 1 ? "s" : ""}`
              : "toutes ses copies"}
          </strong>{" "}
          (réponses, notes, incidents) seront effacés. <strong>Action irréversible</strong> :
          téléchargez la grille ou les copies avant si vous devez les garder.
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          Tapez SUPPRIMER pour confirmer
          <input
            value={typed}
            onChange={(ev) => setTyped(ev.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-10 rounded-field border border-line bg-surface px-3 font-mono text-[14px] tracking-wider uppercase outline-none focus:border-danger-fill focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
