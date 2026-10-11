"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircleQuestion,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  DoorClosed,
  Megaphone,
  Search,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { ProgressStrip } from "@/components/exam/progress-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { InlineAction } from "@/components/ui/inline-action";
import { closeExamNowAction } from "@/features/exams/server/actions";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import {
  formatAgo,
  formatRemaining,
  LIVE_STATUS_LABELS,
  LIVE_STATUS_TONE,
  SANCTION_LABELS,
  SANCTION_TONE,
} from "../labels";
import { answerHelpAction, broadcastAction, extendExamAction } from "../server/actions";
import type { MonitorAlert, MonitorData, MonitorHelp, MonitorStudent } from "../types";
import { monitorApi, monitorKeys } from "./api";
import { StudentPanel } from "./student-panel";
import { type LiveToast, unlockAudio, useLiveAlerts, useStoredFlag } from "./use-live-alerts";
import { LocalTime } from "@/components/ui/local-time";

const POLL_MS = 4_000;

type Filter = "watch" | "all" | "active" | "waiting" | "done";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "watch", label: "À surveiller" },
  { id: "active", label: "En cours" },
  { id: "waiting", label: "Pas commencé" },
  { id: "done", label: "Terminés" },
];

/** Étudiant qui demande l'attention du formateur. */
export function needsAttention(s: MonitorStudent): boolean {
  return (
    s.status === "OFFLINE" ||
    s.status === "AUTO_SUBMITTED" ||
    s.flagged ||
    (s.violationCount > 0 && s.status === "IN_PROGRESS")
  );
}

function matches(s: MonitorStudent, filter: Filter): boolean {
  switch (filter) {
    case "watch":
      return needsAttention(s);
    case "active":
      return s.status === "IN_PROGRESS" || s.status === "OFFLINE";
    case "waiting":
      return s.status === "NOT_STARTED";
    case "done":
      return s.status === "FINISHED" || s.status === "AUTO_SUBMITTED";
    default:
      return true;
  }
}

const STATUS_ORDER: Record<MonitorStudent["status"], number> = {
  OFFLINE: 0,
  IN_PROGRESS: 1,
  AUTO_SUBMITTED: 2,
  NOT_STARTED: 3,
  FINISHED: 4,
};

/** Alertes d'abord, puis en cours, puis le reste ; ordre alphabétique ensuite. */
export function sortStudents(list: MonitorStudent[]): MonitorStudent[] {
  return [...list].sort(
    (a, b) =>
      Number(needsAttention(b)) - Number(needsAttention(a)) ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.fullName.localeCompare(b.fullName, "fr"),
  );
}

// ─── Écran ───────────────────────────────────────────────────────────────────

export function MonitorBoard({ initialData }: { initialData: MonitorData }) {
  const examId = initialData.exam.id;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: monitorKeys.board(examId),
    queryFn: () => monitorApi.board(examId),
    initialData,
    // Données fraîches du rendu serveur : pas de requête en double au montage.
    initialDataUpdatedAt: Date.parse(initialData.serverNow),
    staleTime: POLL_MS - 1_000,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    retry: 1,
  });
  const data = query.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: monitorKeys.board(examId) });

  const [sound, setSound] = useStoredFlag("agexam.monitor.sound", true);
  const [notify, setNotify] = useStoredFlag("agexam.monitor.notify", false);
  const { toasts, push, dismiss } = useLiveAlerts(data, {
    sound,
    notify,
    examTitle: data.exam.title,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  // Badge dans le titre de l'onglet : visible même quand le formateur est ailleurs.
  const attention = data.students.filter(needsAttention).length;
  // Réappliqué à chaque rafraîchissement (le titre des métadonnées peut arriver après l'hydratation).
  // À la navigation, Next remet le titre de la page suivante.
  const tabTitle = `${attention > 0 ? `(${attention}) ` : ""}Suivi · ${data.exam.title}`;
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle, data.serverNow]);

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const f of FILTERS) c[f.id] = data.students.filter((s) => matches(s, f.id)).length;
    return c;
  }, [data.students]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortStudents(
      data.students.filter(
        (s) =>
          matches(s, filter) &&
          (!q || s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)),
      ),
    );
  }, [data.students, filter, search]);

  const selected = data.students.find((s) => s.profileId === selectedId) ?? null;
  const selectByAttempt = (attemptId: string | null | undefined) => {
    const s = data.students.find((x) => x.attemptId === attemptId);
    if (s) setSelectedId(s.profileId);
  };

  const report = (state: ActionState<unknown>) => {
    if (state.status === "success")
      push({ tone: "success", title: state.message ?? "C'est fait." });
    else if (state.status === "error") push({ tone: "danger", title: state.message });
    void refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <ControlBar
        data={data}
        stale={query.isError}
        sound={sound}
        notify={notify}
        onSound={(v) => {
          if (v) unlockAudio();
          setSound(v);
        }}
        onNotify={async (v) => {
          if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
            const permission = await Notification.requestPermission().catch(() => "denied");
            if (permission !== "granted") {
              push({
                tone: "warning",
                title: "Notifications refusées par le navigateur.",
                body: "Autorisez-les dans les réglages du site pour être prévenu quand l'onglet est en arrière-plan.",
              });
              return;
            }
          }
          setNotify(v);
        }}
        onDone={report}
      />

      <Kpis data={data} onPick={setFilter} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <div
              role="tablist"
              aria-label="Filtrer les étudiants"
              className="flex flex-wrap gap-1.5"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold transition-colors",
                    filter === f.id ? "bg-primary-wash text-primary" : "text-muted hover:bg-canvas",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px]",
                      "bg-surface ring-1 ring-line",
                      f.id === "watch" &&
                        counts.watch > 0 &&
                        filter !== f.id &&
                        "bg-danger-bg text-danger",
                    )}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Rechercher un étudiant</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="h-9 w-52 rounded-full border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <StudentTable
            students={visible}
            serverNow={data.serverNow}
            selectedId={selectedId}
            onSelect={setSelectedId}
            empty={data.students.length === 0 ? "none" : "filtered"}
          />
          <Legend />
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          {selected ? (
            <StudentPanel
              key={selected.profileId}
              examId={examId}
              student={selected}
              serverNow={data.serverNow}
              onClose={() => setSelectedId(null)}
              onDone={report}
            />
          ) : (
            <>
              <HelpFeed help={data.help ?? []} serverNow={data.serverNow} onDone={report} />
              <AlertsFeed
                alerts={data.alerts}
                serverNow={data.serverNow}
                onOpen={selectByAttempt}
              />
            </>
          )}
        </aside>
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} onOpen={selectByAttempt} />
    </div>
  );
}

// ─── Barre de contrôle ──────────────────────────────────────────────────────

function ControlBar({
  data,
  stale,
  sound,
  notify,
  onSound,
  onNotify,
  onDone,
}: {
  data: MonitorData;
  stale: boolean;
  sound: boolean;
  notify: boolean;
  onSound: (v: boolean) => void;
  onNotify: (v: boolean) => void;
  onDone: (state: ActionState<unknown>) => void;
}) {
  const { exam } = data;
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState(exam.liveMessage ?? "");
  const [pending, start] = useTransition();
  const live = exam.phase === "OUVERT";
  const canExtend = exam.phase !== "BROUILLON" && exam.phase !== "ARCHIVE" && !!exam.closesAt;
  const remaining = live ? formatRemaining(exam.closesAt, data.serverNow) : null;

  const send = (text: string) =>
    start(async () => {
      const result = await broadcastAction(exam.id, text);
      onDone(result);
      if (result.status === "success") {
        setComposing(false);
        setMessage(text.trim());
      }
    });

  const extend = (minutes: number) =>
    start(async () => onDone(await extendExamAction(exam.id, minutes)));

  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ExamPhaseBadge phase={exam.phase} />
          <span
            className={cn(
              "inline-flex items-center gap-2 text-sm font-bold",
              stale ? "text-warning" : "text-success",
            )}
            aria-live="polite"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                stale ? "bg-warning-fill" : "animate-pulse bg-mint-strong",
              )}
              aria-hidden
            />
            {stale ? "Connexion au serveur perdue, nouvel essai…" : "En direct"}
          </span>
          {exam.accessCode ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              Code
              <strong className="font-mono text-lg tracking-[0.2em] text-ink">
                {exam.accessCode}
              </strong>
              <CopyButton value={exam.accessCode} variant="ghost" size="sm" label="Copier" />
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" aria-hidden />
            {exam.closesAt ? (
              <>
                Fermeture à{" "}
                <strong className="text-ink">
                  <LocalTime date={exam.closesAt} />
                </strong>
                {remaining ? <span>(reste {remaining.replace(/:\d\d$/, "")} min)</span> : null}
              </>
            ) : (
              "Sans date de fermeture"
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={sound}
            onClick={() => onSound(!sound)}
            title={sound ? "Couper le son des alertes" : "Activer le son des alertes"}
          >
            {sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
            {sound ? "Son activé" : "Son coupé"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={notify}
            onClick={() => onNotify(!notify)}
            title="Notification du système quand l'onglet est en arrière-plan"
          >
            {notify ? <Bell aria-hidden /> : <BellOff aria-hidden />}
            {notify ? "Notifications" : "Notifications off"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setComposing((v) => !v)}>
            <Megaphone aria-hidden />
            Message à tous
          </Button>
          {live ? (
            <InlineAction
              action={closeExamNowAction}
              fields={{ examId: exam.id }}
              variant="danger"
              size="sm"
              label={
                <>
                  <DoorClosed aria-hidden />
                  Fermer l&apos;examen
                </>
              }
              confirmMessage="Fermer l'examen maintenant ? Les copies en cours seront soumises avec les réponses enregistrées."
            />
          ) : null}
        </div>
      </div>

      {exam.liveMessage && !composing ? (
        <div className="flex items-center justify-between gap-3 rounded-field bg-lilac px-3.5 py-2 text-sm">
          <p>
            <strong className="text-primary-strong">Message affiché aux étudiants : </strong>
            {exam.liveMessage}
          </p>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => send("")}>
            Effacer
          </Button>
        </div>
      ) : null}

      {composing ? (
        <form
          className="flex flex-col gap-2 rounded-field border border-line-soft bg-canvas p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(message);
          }}
        >
          <label htmlFor="live-message" className="text-sm font-bold">
            Message affiché en bandeau sur l&apos;écran de chaque étudiant
          </label>
          <textarea
            id="live-message"
            value={message}
            maxLength={280}
            rows={2}
            autoFocus
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : la question 7 comporte une coquille, choisissez la réponse la plus proche."
            className="resize-none rounded-field border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{message.length}/280</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={pending || !message.trim()}>
                Envoyer
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {canExtend ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-sm">
          <span className="font-semibold text-muted">Repousser la fermeture :</span>
          {[5, 15, 30].map((m) => (
            <Button key={m} variant="soft" size="sm" disabled={pending} onClick={() => extend(m)}>
              +{m} min
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ─── Indicateurs ─────────────────────────────────────────────────────────────

function Kpis({ data, onPick }: { data: MonitorData; onPick: (f: Filter) => void }) {
  const { summary } = data;
  const items: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: string;
    filter: Filter;
    hint?: string;
  }[] = [
    {
      label: "Inscrits",
      value: summary.enrolled,
      icon: <Users />,
      tone: "text-ink",
      filter: "all",
    },
    {
      label: "En cours",
      value: summary.inProgress,
      icon: <span className="size-2.5 rounded-full bg-primary" />,
      tone: "text-primary-strong",
      filter: "active",
    },
    {
      label: "Hors ligne",
      value: summary.offline,
      icon: <WifiOff />,
      tone: summary.offline ? "text-warning" : "text-ink",
      filter: "active",
    },
    {
      label: "Terminés",
      value: summary.finished,
      icon: <CheckCircle2 />,
      tone: "text-success",
      filter: "done",
    },
    {
      label: "Pas commencé",
      value: summary.notStarted,
      icon: <Clock />,
      tone: "text-ink",
      filter: "waiting",
    },
    {
      label: "Alertes actives",
      value: summary.activeAlerts,
      icon: <AlertTriangle />,
      tone: summary.activeAlerts ? "text-danger" : "text-ink",
      filter: "watch",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={() => onPick(k.filter)}
          className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-primary"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase [&_svg]:size-4">
            {k.icon}
            {k.label}
          </span>
          <span className={cn("font-display text-3xl font-bold tabular-nums", k.tone)}>
            {k.value}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Tableau ─────────────────────────────────────────────────────────────────

function StudentTable({
  students,
  serverNow,
  selectedId,
  onSelect,
  empty,
}: {
  students: MonitorStudent[];
  serverNow: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  empty: "none" | "filtered";
}) {
  if (students.length === 0) {
    return (
      <p className="px-6 py-14 text-center text-[15px] text-muted">
        {empty === "none"
          ? "Aucun étudiant dans les groupes de cet examen."
          : "Aucun étudiant ne correspond à ce filtre."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line-soft text-left text-[12px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
            <th className="px-4 py-2.5">Étudiant</th>
            <th className="px-3 py-2.5">Progression</th>
            <th className="px-3 py-2.5">Question</th>
            <th className="px-3 py-2.5">Statut</th>
            <th className="px-3 py-2.5 text-center">Sorties</th>
            <th className="px-3 py-2.5">Activité</th>
            <th className="px-4 py-2.5 text-right">Note</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const alert = needsAttention(s);
            const remaining =
              s.status === "IN_PROGRESS" || s.status === "OFFLINE"
                ? formatRemaining(s.currentExpiresAt, serverNow)
                : null;
            return (
              <tr
                key={s.profileId}
                onClick={() => onSelect(s.profileId)}
                aria-selected={selectedId === s.profileId}
                className={cn(
                  "cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-primary-wash",
                  alert && "bg-danger-bg/40",
                  selectedId === s.profileId && "bg-lilac hover:bg-lilac",
                )}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="flex flex-col text-left"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(s.profileId);
                    }}
                  >
                    <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap text-ink">
                      {alert ? (
                        <AlertTriangle className="size-4 text-danger" aria-label="À surveiller" />
                      ) : null}
                      {s.fullName}
                    </span>
                    <span className="max-w-[200px] truncate text-xs text-muted">{s.email}</span>
                  </button>
                </td>
                <td className="w-40 px-3 py-3">
                  {s.total > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <ProgressStrip cells={s.cells} size="sm" />
                      <span className="text-xs text-muted tabular-nums">
                        {s.answered}/{s.total} répondues
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {s.currentNumber ? (
                    <span className="flex flex-col">
                      <span className="font-bold">
                        Q{s.currentNumber}/{s.total}
                      </span>
                      {remaining ? (
                        <span className="text-xs text-muted">reste {remaining}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={LIVE_STATUS_TONE[s.status]}>
                    {s.status === "OFFLINE" ? <WifiOff className="size-3.5" aria-hidden /> : null}
                    {LIVE_STATUS_LABELS[s.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-center">
                  {s.violationCount > 0 ? (
                    <span className="inline-flex min-w-7 justify-center rounded-full bg-danger-bg px-2 py-0.5 font-bold text-danger tabular-nums">
                      {s.violationCount}
                    </span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap text-muted tabular-nums">
                  {s.status === "IN_PROGRESS" || s.status === "OFFLINE" ? (
                    `il y a ${formatAgo(s.lastSeenAt, serverNow)}`
                  ) : s.submittedAt ? (
                    <>
                      rendu à <LocalTime date={s.submittedAt} />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">
                  {s.scoreOutOf20 !== null
                    ? `${s.scoreOutOf20.toFixed(2).replace(".", ",")}/20`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  const items = [
    ["bg-primary", "Répondue"],
    ["bg-mint ring-1 ring-mint-strong", "En cours"],
    ["bg-[#9aa3bd]", "Temps écoulé"],
    ["bg-danger-fill", "Invalidée"],
    ["bg-[#c9cfde]", "Neutralisée"],
    ["bg-line", "À venir"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2.5 text-xs text-muted">
      {items.map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", cls)} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Questions des étudiants ────────────────────────────────────────────────

function HelpFeed({
  help,
  serverNow,
  onDone,
}: {
  help: MonitorHelp[];
  serverNow: string;
  onDone: (state: ActionState<unknown>) => void;
}) {
  const pending = help.filter((h) => !h.answer);
  if (help.length === 0) return null;
  return (
    <section className="mb-5 flex flex-col rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden />
          Questions des étudiants
        </h2>
        {pending.length ? (
          <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">
            {pending.length} en attente
          </span>
        ) : null}
      </header>
      <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
        {help.map((h) => (
          <HelpItemRow key={h.id} item={h} serverNow={serverNow} onDone={onDone} />
        ))}
      </ul>
    </section>
  );
}

function HelpItemRow({
  item,
  serverNow,
  onDone,
}: {
  item: MonitorHelp;
  serverNow: string;
  onDone: (state: ActionState<unknown>) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold">{item.studentName}</span>
        <span className="shrink-0 text-xs text-muted tabular-nums">
          il y a {formatAgo(item.at, serverNow)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-line">{item.message}</p>
      {item.answer ? (
        <p className="rounded-field bg-success-bg px-3 py-2 text-sm text-success">
          Répondu : {item.answer}
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!answer.trim()) return;
            start(async () => onDone(await answerHelpAction(item.id, answer)));
          }}
        >
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={500}
            placeholder="Votre réponse…"
            aria-label={`Réponse à ${item.studentName}`}
            className="h-9 min-w-0 flex-1 rounded-field border border-line px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={pending || !answer.trim()}>
            Envoyer
          </Button>
        </form>
      )}
    </li>
  );
}

// ─── Fil des alertes ─────────────────────────────────────────────────────────

function AlertsFeed({
  alerts,
  serverNow,
  onOpen,
}: {
  alerts: MonitorAlert[];
  serverNow: string;
  onOpen: (attemptId: string) => void;
}) {
  return (
    <section className="flex flex-col rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="font-display text-lg font-bold">Alertes</h2>
        <span className="text-xs text-muted">Cliquez un étudiant pour le détail</span>
      </header>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <CheckCircle2 className="size-8 text-mint-strong" aria-hidden />
          <p className="font-bold">Aucune alerte</p>
          <p className="text-sm text-muted">
            Les sorties du mode examen et les sanctions apparaîtront ici, avec un son.
          </p>
        </div>
      ) : (
        <ul className="max-h-[560px] divide-y divide-line-soft overflow-y-auto">
          {alerts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a.attemptId)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-wash",
                  a.revoked && "opacity-60",
                )}
              >
                <AlertTriangle
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    a.revoked
                      ? "text-muted"
                      : SANCTION_TONE[a.sanction] === "danger"
                        ? "text-danger"
                        : "text-warning",
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{a.studentName}</span>
                  <span className={cn("text-sm", a.revoked && "line-through")}>
                    {SANCTION_LABELS[a.sanction]} · violation n° {a.violationNumber}
                  </span>
                  {a.revoked ? (
                    <span className="text-xs font-semibold text-muted">
                      Annulée par le formateur
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  il y a {formatAgo(a.at, serverNow)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Notifications à l'écran ────────────────────────────────────────────────

const TOAST_TONE: Record<LiveToast["tone"], string> = {
  danger: "border-l-danger-fill",
  warning: "border-l-warning-fill",
  success: "border-l-mint-strong",
  info: "border-l-primary",
};

function Toasts({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: LiveToast[];
  onDismiss: (id: string) => void;
  onOpen: (attemptId: string) => void;
}) {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-[360px] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
  onOpen,
}: {
  toast: LiveToast;
  onDismiss: (id: string) => void;
  onOpen: (attemptId: string) => void;
}) {
  useEffect(() => {
    const ms = toast.tone === "danger" || toast.tone === "warning" ? 12_000 : 4_000;
    const timer = window.setTimeout(() => onDismiss(toast.id), ms);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-field border border-l-4 border-line bg-surface px-3.5 py-3 shadow-pop",
        TOAST_TONE[toast.tone],
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col text-left"
        disabled={!toast.attemptId}
        onClick={() => {
          if (toast.attemptId) onOpen(toast.attemptId);
          onDismiss(toast.id);
        }}
      >
        <span className="text-sm font-bold">{toast.title}</span>
        {toast.body ? <span className="text-xs text-muted">{toast.body}</span> : null}
      </button>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-full p-1 text-muted hover:bg-canvas"
        aria-label="Fermer"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
