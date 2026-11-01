"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Code2,
  Info,
  Clock,
  ListChecks,
  LoaderCircle,
  Maximize,
  Megaphone,
  MessageCircleQuestion,
  Timer,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
  PenLine,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LogoMark } from "@/components/brand/logo";
import { CodeBlock } from "@/components/exam/code-block";
import { Button } from "@/components/ui/button";
import { clockOffsetMs } from "@/domain/attempt-timer";
import type { SanctionType, SecurityEventType } from "@/domain/enums";
import { MIN_AWAY_MS } from "@/domain/violations";
import { cn } from "@/lib/utils";
import { CELL_CLASS } from "@/components/exam/progress-strip";
import type { AttemptClientState, ClientSecurityEvent, HelpItem } from "../types";
import { ApiError, attemptApi, initAttemptSession, isSessionElsewhere, NetworkError } from "./api";
import { AlgoPlayground } from "@/features/algo/client/algo-playground";
import { PracticeFeedbackCard } from "./practice-feedback";

// ─── Plein écran (source externe → useSyncExternalStore) ─────────────────────

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}
const useIsFullscreen = () =>
  useSyncExternalStore(
    subscribeFullscreen,
    () => !!document.fullscreenElement,
    () => true,
  );

const enterFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => undefined);

// ─── Libellés ────────────────────────────────────────────────────────────────

const SANCTION_TEXT: Record<SanctionType, { title: string; body: string }> = {
  AUCUNE: { title: "Sortie enregistrée", body: "Cet événement est transmis à votre formateur." },
  AVERTISSEMENT: {
    title: "Avertissement",
    body: "Vous avez quitté le mode examen. Restez en plein écran : une nouvelle sortie sur cette question l'invalidera.",
  },
  PENALITE: { title: "Pénalité", body: "Une pénalité a été enregistrée." },
  INVALIDER_QUESTION: {
    title: "Question invalidée",
    body: "Deuxième sortie du mode examen sur cette question : elle compte 0 et vous passez à la suivante. Le compteur repart à zéro pour la nouvelle question.",
  },
  SOUMISSION_AUTO: {
    title: "Examen soumis automatiquement",
    body: "Le nombre maximal de sorties du mode examen est atteint. Vos réponses enregistrées sont conservées.",
  },
};

const NEXT_SANCTION_TEXT: Record<SanctionType, string> = {
  AUCUNE: "sera enregistrée",
  AVERTISSEMENT: "donnera un avertissement",
  PENALITE: "donnera une pénalité",
  INVALIDER_QUESTION: "invalidera la question en cours",
  SOUMISSION_AUTO: "soumettra l'examen automatiquement",
};

const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (total >= 3600) {
    return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  }
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

// ─── Composant ───────────────────────────────────────────────────────────────

const codeBackupKey = (qid: string) => `agexam_exam_code_${qid}`;
function readCodeBackup(qid: string): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(codeBackupKey(qid));
  } catch {
    return null;
  }
}
function writeCodeBackup(qid: string, text: string) {
  try {
    localStorage.setItem(codeBackupKey(qid), text);
  } catch {
    /* stockage indisponible */
  }
}

export function ExamRunner({ initialState }: { initialState: AttemptClientState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const attemptId = state.attemptId;
  const question = state.question;

  // Sélection locale, remise à zéro quand la question change.
  const [selection, setSelection] = useState<{ qid: string | null; ids: string[] }>({
    qid: question?.attemptQuestionId ?? null,
    ids: question?.selectedOptionIds ?? [],
  });
  if ((question?.attemptQuestionId ?? null) !== selection.qid) {
    setSelection({
      qid: question?.attemptQuestionId ?? null,
      ids: question?.selectedOptionIds ?? [],
    });
  }
  const selected = selection.ids;
  /** Réponse libre : algorithme ou texte rédigé (même enregistrement, même correction). */
  const isAlgo = question?.kind === "algo" || question?.kind === "texte";
  const isText = question?.kind === "texte";

  // Algorithme local (question d'algorithme), remis à zéro quand la question change.
  const [codeDraft, setCodeDraft] = useState<{ qid: string | null; text: string }>({
    qid: question?.attemptQuestionId ?? null,
    text: question?.codeAnswer ?? "",
  });
  if ((question?.attemptQuestionId ?? null) !== codeDraft.qid) {
    const id = question?.attemptQuestionId ?? null;
    const server = question?.codeAnswer ?? "";
    // Copie de secours locale : reprise si le serveur n'a rien reçu (coupure, onglet rechargé).
    const local = id && question?.kind !== "choice" && question ? readCodeBackup(id) : null;
    setCodeDraft({ qid: id, text: local && local.trim() && local !== server ? local : server });
  }
  const code = codeDraft.text;
  const answered = isAlgo ? code.trim().length > 0 : selected.length > 0;
  /** Validation d'un algorithme : confirmation demandée (définitive). */
  const [confirmAlgo, setConfirmAlgo] = useState(false);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    question?.selectedOptionIds.length ? "saved" : "idle",
  );
  const [online, setOnline] = useState(true);
  /** Premier chargement de la question (la page serveur ne l'envoie pas). */
  const [booting, setBooting] = useState(!initialState.finished);
  /** Examen ouvert dans un autre onglet / appareil qui a la main. */
  const [elsewhere, setElsewhere] = useState(false);
  /** Questions au formateur et réponses (reçues avec le signal de présence). */
  const [help, setHelp] = useState<HelpItem[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissedAnswers, setDismissedAnswers] = useState<string[]>([]);
  // Coupure réseau : le chrono affiché se fige (le serveur rend ce temps au retour).
  const onlineRef = useRef(true);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);
  const [busy, setBusy] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  /** Dernière question : un 2ᵉ clic confirme la remise définitive de la copie. */
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState(15);
  // Message du formateur : masquable, réapparaît si un nouveau message arrive.
  const [dismissedMessageAt, setDismissedMessageAt] = useState<string | null>(null);
  // Temps ajouté par le formateur : détecté quand l'échéance de la même question recule.
  const [expiry, setExpiry] = useState({
    qid: initialState.question?.attemptQuestionId ?? null,
    at: initialState.question?.expiresAt ?? null,
  });
  const [extraNotice, setExtraNotice] = useState<{ id: number; seconds: number } | null>(null);
  const [sanction, setSanction] = useState<{ type: SanctionType; violationNumber: number } | null>(
    null,
  );
  const isFullscreen = useIsFullscreen();

  const qid = question?.attemptQuestionId ?? null;
  const expiresAt = question?.expiresAt ?? null;
  if (qid !== expiry.qid || expiresAt !== expiry.at) {
    const gained =
      qid && qid === expiry.qid && expiresAt && expiry.at
        ? Math.round((Date.parse(expiresAt) - Date.parse(expiry.at)) / 1000)
        : 0;
    setExpiry({ qid, at: expiresAt });
    if (gained >= 5) setExtraNotice({ id: Date.parse(expiresAt!), seconds: gained });
  }
  useEffect(() => {
    if (!extraNotice) return;
    const timer = window.setTimeout(() => setExtraNotice(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [extraNotice]);
  const message = state.message && state.message.at !== dismissedMessageAt ? state.message : null;

  const offsetRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const queueRef = useRef<ClientSecurityEvent[]>([]);
  const flushingRef = useRef(false);
  const saveSeqRef = useRef(0);
  /** Clic de réponse : envoi groupé après une courte pause (plusieurs clics = une requête). */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Sélection pas encore acceptée par le serveur (renvoyée à la reconnexion). */
  const pendingSaveRef = useRef<{ qid: string; ids: string[]; code?: string } | null>(null);
  /** Validation en attente pendant une coupure : renvoyée jusqu'au succès (idempotente). */
  const pendingNextRef = useRef<{ qid: string; ids: string[]; code?: string } | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Chrono figé pendant la validation : le temps d'attente du réseau n'est pas affiché. */
  const [frozenMs, setFrozenMs] = useState<number | null>(null);

  // ── Synchronisation ─────────────────────────────────────────────────────────

  const applyState = useCallback((next: AttemptClientState) => {
    setState(next);
    if (next.help) setHelp(next.help);
    setOnline(true);
    setElsewhere(false);
    setBooting(false);
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof NetworkError) setOnline(false);
      else if (isSessionElsewhere(error)) {
        setElsewhere(true);
        setBooting(false);
      } else if (error instanceof ApiError && error.status === 401) router.replace("/connexion");
    },
    [router],
  );

  // Prise de main de cet onglet, puis chargement de la question.
  useEffect(() => {
    initAttemptSession(attemptId);
    attemptApi.state(attemptId).then(applyState, handleError);
  }, [attemptId, applyState, handleError]);

  /** Mesure le décalage entre l'horloge du PC et celle du serveur. */
  const syncClock = useCallback(async () => {
    const t0 = Date.now();
    const { serverTime } = await attemptApi.serverTime();
    const t1 = Date.now();
    if (t1 - t0 <= bestRttRef.current * 1.5) {
      bestRttRef.current = Math.min(bestRttRef.current, t1 - t0);
      offsetRef.current = clockOffsetMs(serverTime, t0, t1);
    }
  }, []);

  const flushEvents = useCallback(async () => {
    if (flushingRef.current || queueRef.current.length === 0) return;
    flushingRef.current = true;
    const batch = queueRef.current.splice(0, 20);
    try {
      const res = await attemptApi.events(attemptId, batch);
      applyState(res.state);
      if (res.sanction) setSanction(res.sanction);
    } catch (error) {
      // Hors ligne : les événements repartiront à la reconnexion.
      // Onglet sans la main : ses événements ne comptent pas.
      if (!isSessionElsewhere(error)) queueRef.current.unshift(...batch);
      handleError(error);
    } finally {
      flushingRef.current = false;
    }
  }, [attemptId, applyState, handleError]);

  const report = useEffectEvent((type: SecurityEventType, awayMs?: number) => {
    // Après la soumission (sortie du plein écran volontaire), plus rien n'est signalé.
    // Entraînement : pas de surveillance.
    if (state.finished || state.practice) return;
    queueRef.current.push({
      type,
      at: new Date().toISOString(),
      attemptQuestionId: state.question?.attemptQuestionId ?? null,
      awayMs: awayMs ?? null,
    });
    void flushEvents();
  });

  // ── Réponses ────────────────────────────────────────────────────────────────

  const save = useCallback(
    async (qid: string, ids: string[], code?: string) => {
      const seq = ++saveSeqRef.current;
      pendingSaveRef.current = { qid, ids, code };
      try {
        const res =
          code !== undefined
            ? await attemptApi.code(attemptId, qid, code)
            : await attemptApi.answer(attemptId, qid, ids);
        if (seq !== saveSeqRef.current) return;
        pendingSaveRef.current = null;
        setSaveStatus(res.accepted ? "saved" : "idle");
        if (!res.accepted) applyState(res.state);
        else setOnline(true);
      } catch (error) {
        if (seq === saveSeqRef.current) setSaveStatus("error");
        handleError(error);
      }
    },
    [attemptId, applyState, handleError],
  );

  const cancelScheduledSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  };

  const toggle = useCallback(
    (optionId: string) => {
      if (!question || busy) return;
      const ids = question.multiple
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
      setSelection({ qid: question.attemptQuestionId, ids });
      setConfirmSkip(false);
      setConfirmFinish(false);
      // Affichage immédiat ; l'envoi part 250 ms après le dernier clic.
      setSaveStatus("saving");
      const qid = question.attemptQuestionId;
      pendingSaveRef.current = { qid, ids };
      cancelScheduledSave();
      saveTimerRef.current = setTimeout(() => void save(qid, ids), 250);
    },
    [question, busy, selected, save],
  );

  // Copie de secours reprise : renvoyée tout de suite au serveur.
  const pushRestoredCode = useEffectEvent(() => {
    if (!question || question.kind === "choice") return;
    if (code.trim() && code !== (question.codeAnswer ?? "")) {
      void save(question.attemptQuestionId, [], code);
    }
  });
  useEffect(() => {
    if (codeDraft.qid) pushRestoredCode();
  }, [codeDraft.qid]);

  /** Algorithme : enregistré 1,5 s après la dernière frappe. */
  const editCode = useCallback(
    (text: string) => {
      if (!question || busy || question.kind === "choice") return;
      const qid = question.attemptQuestionId;
      setCodeDraft({ qid, text });
      writeCodeBackup(qid, text);
      setConfirmSkip(false);
      setConfirmAlgo(false);
      setConfirmFinish(false);
      setSaveStatus("saving");
      pendingSaveRef.current = { qid, ids: [], code: text };
      cancelScheduledSave();
      saveTimerRef.current = setTimeout(() => void save(qid, [], text), 1_500);
    },
    [question, busy, save],
  );

  /** Envoie la validation en attente ; en cas de coupure, réessaie toutes les 2 s. */
  const sendNext = useCallback(
    async function run(): Promise<void> {
      const pending = pendingNextRef.current;
      if (!pending) return;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      try {
        const next = await attemptApi.next(attemptId, pending.qid, pending.ids, pending.code);
        pendingNextRef.current = null;
        applyState(next);
        setSaveStatus("idle");
        setBusy(false);
        setFrozenMs(null);
      } catch (error) {
        handleError(error);
        if (error instanceof NetworkError) {
          retryTimerRef.current = setTimeout(() => void run(), 2_000);
        } else {
          // Refus du serveur (question déjà close…) : on reprend l'état réel.
          pendingNextRef.current = null;
          setBusy(false);
          setFrozenMs(null);
          attemptApi
            .state(attemptId)
            .then(applyState)
            .catch(() => undefined);
        }
      }
    },
    [attemptId, applyState, handleError],
  );

  const goNext = useCallback(
    async (force = false) => {
      if (!question || busy) return;
      if (!force && !answered && !confirmSkip) {
        setConfirmSkip(true);
        return;
      }
      // Algorithme : validation définitive, confirmée (vaut aussi remise si dernière question).
      if (!force && isAlgo && answered && !confirmAlgo) {
        setConfirmSkip(false);
        setConfirmAlgo(true);
        return;
      }
      const last = question.number === state.total;
      if (!force && !isAlgo && last && !state.practice && !confirmFinish) {
        setConfirmSkip(false);
        setConfirmFinish(true);
        return;
      }
      setConfirmFinish(false);
      setConfirmAlgo(false);
      setBusy(true);
      setFrozenMs(remainingMs);
      setConfirmSkip(false);
      // La validation porte la sélection : l'enregistrement en attente devient inutile.
      cancelScheduledSave();
      saveSeqRef.current++;
      pendingSaveRef.current = null;
      pendingNextRef.current = {
        qid: question.attemptQuestionId,
        ids: isAlgo ? [] : selected,
        code: isAlgo ? code : undefined,
      };
      await sendNext();
    },
    [
      question,
      busy,
      selected,
      isAlgo,
      answered,
      code,
      confirmAlgo,
      confirmSkip,
      confirmFinish,
      state.total,
      state.practice,
      remainingMs,
      sendNext,
    ],
  );

  /** Retour du réseau : validation puis réponse en attente, puis état à jour. */
  const resumeAfterOutage = useEffectEvent(() => {
    // « En ligne » seulement après une réponse du serveur (applyState) : sinon le
    // chrono reprendrait avec l'ancienne échéance avant que le temps soit rendu.
    if (pendingNextRef.current) {
      void sendNext();
      return;
    }
    const pendingSave = pendingSaveRef.current;
    if (pendingSave && !saveTimerRef.current)
      void save(pendingSave.qid, pendingSave.ids, pendingSave.code);
    void flushEvents();
  });

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  // ── Chrono de la question ───────────────────────────────────────────────────

  const onTimeUp = useEffectEvent(async () => {
    const qid = question?.attemptQuestionId;
    // Le serveur fait foi : après une coupure, il a pu rendre du temps à la
    // question (chrono en pause). On relit l'état avant de valider : aucune
    // question n'est sautée à cause d'une échéance locale périmée.
    try {
      const fresh = await attemptApi.state(attemptId);
      applyState(fresh);
      const q = fresh.question;
      if (!q || q.attemptQuestionId !== qid) return;
      const left = Date.parse(q.expiresAt) - (Date.now() + offsetRef.current);
      if (left > 1_000) return;
    } catch (error) {
      // Hors ligne : on reste sur la question, chrono figé.
      handleError(error);
      return;
    }
    // Le serveur accepte encore quelques secondes : on envoie la sélection telle quelle.
    void goNext(true);
  });

  const currentQid = question?.attemptQuestionId ?? null;
  const currentExpiresAt = question?.expiresAt ?? null;
  useEffect(() => {
    if (!currentQid || !currentExpiresAt) return;
    const expires = new Date(currentExpiresAt).getTime();
    let fired = false;
    const tick = () => {
      if (!onlineRef.current) return;
      const rem = expires - (Date.now() + offsetRef.current);
      setRemainingMs(Math.max(0, rem));
      if (rem <= 0 && !fired) {
        fired = true;
        onTimeUp();
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [currentQid, currentExpiresAt]);

  // ── Présence (heartbeat) et horloge ─────────────────────────────────────────

  useEffect(() => {
    syncClock().catch(() => undefined);
    const id = setInterval(async () => {
      try {
        const t0 = Date.now();
        const next = await attemptApi.state(attemptId);
        const t1 = Date.now();
        if (t1 - t0 <= bestRttRef.current * 1.5) {
          offsetRef.current = clockOffsetMs(new Date(next.serverNow).getTime(), t0, t1);
        }
        // Pendant une validation en attente, l'état serveur (ancienne question) n'est pas appliqué.
        if (!pendingNextRef.current) applyState(next);
        resumeAfterOutage();
      } catch (error) {
        handleError(error);
      }
    }, state.settings.heartbeatIntervalSec * 1000);
    return () => clearInterval(id);
  }, [
    attemptId,
    state.settings.heartbeatIntervalSec,
    syncClock,
    applyState,
    flushEvents,
    handleError,
  ]);

  // ── Surveillance du navigateur ──────────────────────────────────────────────

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") report("PAGE_RELOAD");

    // Sortie réelle de la fenêtre : mesurée du départ au retour, signalée au
    // retour si elle a duré au moins MIN_AWAY_MS (une notification ne compte pas).
    // Une « sortie » = du départ du mode examen (plein écran quitté, autre onglet
    // ou application) jusqu'au retour en plein écran. Elle compte UNE fois, même
    // si Alt+Tab déclenche à la fois sortie du plein écran et perte du focus.
    let inSortie = false;
    let awayStart: number | null = null;
    let wasHidden = false;
    const leave = (hidden: boolean) => {
      awayStart ??= Date.now();
      if (hidden) wasHidden = true;
    };
    const back = () => {
      if (awayStart === null) return;
      const awayMs = Date.now() - awayStart;
      const type = wasHidden ? "VISIBILITY_HIDDEN" : "WINDOW_BLUR";
      awayStart = null;
      wasHidden = false;
      // Moins de MIN_AWAY_MS : notification, clic involontaire → ignoré.
      if (awayMs >= MIN_AWAY_MS && !inSortie) report(type, awayMs);
    };
    const onFullscreen = () => {
      if (document.fullscreenElement) {
        report("FULLSCREEN_ENTER");
        inSortie = false;
      } else if (!inSortie) {
        inSortie = true;
        report("FULLSCREEN_EXIT");
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave(true);
      else if (document.hasFocus()) back();
    };
    const onBlur = () => leave(false);
    const onFocus = () => back();
    const onOnline = () => {
      resumeAfterOutage();
      // Temps rendu par le serveur : nouvelle échéance tout de suite.
      if (!pendingNextRef.current) attemptApi.state(attemptId).then(applyState, handleError);
    };
    const onOffline = () => setOnline(false);
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushEvents, attemptId, applyState, handleError]);

  // Copier / coller / clic droit : bloqués si l'examen le demande.
  useEffect(() => {
    if (!state.settings.blockCopyPaste || state.practice) return;
    const block = (type: SecurityEventType) => (e: Event) => {
      e.preventDefault();
      report(type);
    };
    const onCopy = block("COPY_ATTEMPT");
    const onPaste = block("PASTE_ATTEMPT");
    const onMenu = block("CONTEXT_MENU");
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onMenu);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onMenu);
    };
  }, [state.settings.blockCopyPaste, state.practice]);

  // Raccourcis : 1 à 9 pour choisir, Entrée pour valider. F5 / Ctrl+R neutralisés.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
      e.preventDefault();
      return;
    }
    // Saisie d'une question au formateur : les raccourcis ne s'appliquent pas.
    if ((e.target as HTMLElement | null)?.closest?.("textarea, input")) return;
    if (!question || (!isFullscreen && !state.practice) || sanction) return;
    // 1 à 9 ou A à J pour choisir.
    const n = Number(e.key);
    const letter =
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
        ? e.key.toUpperCase().charCodeAt(0) - 64
        : 0;
    const index = Number.isInteger(n) && n >= 1 ? n : letter;
    if (index >= 1 && index <= question.options.length) {
      e.preventDefault();
      toggle(question.options[index - 1]!.id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void goNext();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Entraînement : correction de la dernière question lue avant le bilan.
  const [lastFeedbackSeen, setLastFeedbackSeen] = useState(false);
  const holdOnFeedback = state.practice && !!state.feedback && !lastFeedbackSeen;

  const continuePractice = useCallback(async () => {
    if (state.finished) {
      setLastFeedbackSeen(true);
      return;
    }
    setBusy(true);
    try {
      applyState(await attemptApi.continue(attemptId));
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }, [state.finished, attemptId, applyState, handleError]);

  // Fin de l'examen : sortie du plein écran et page du reçu.
  useEffect(() => {
    if (!state.finished || sanction || holdOnFeedback) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    router.replace(`/etudiant/resultats/${attemptId}` as Route);
  }, [state.finished, sanction, holdOnFeedback, attemptId, router]);

  // ── Rendu ───────────────────────────────────────────────────────────────────

  const duration = (question?.durationSec ?? 1) * 1000;
  // Chrono figé pendant la validation (le serveur a reçu le clic à temps).
  const shownMs = busy && frozenMs !== null ? frozenMs : remainingMs;
  const pct = shownMs === null ? 100 : Math.max(0, Math.min(100, (shownMs / duration) * 100));
  const timeTone = pct > 30 ? "normal" : pct > 10 ? "warn" : "danger";
  const timeUp = !busy && remainingMs !== null && remainingMs <= 0;
  const isLast = question ? question.number === state.total : false;
  const globalTimer = state.timerMode === "GLOBAL";
  const maskQuestion = (!isFullscreen && !state.practice) || !!sanction || !online;
  const latestAnswer = help.find((h) => h.answer && !dismissedAnswers.includes(h.id)) ?? null;
  // Entraînement : correction affichée entre deux questions (et après la dernière).
  const showFeedback =
    state.practice && !!state.feedback && (state.finished ? !lastFeedbackSeen : !question);

  return (
    <div className="flex min-h-screen flex-col bg-canvas select-none">
      {/* En-tête */}
      <header className="border-b border-line bg-surface">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 px-8">
          <div className="flex min-w-0 items-center gap-4">
            <LogoMark className="size-8 shrink-0" />
            <span className="h-6 w-px bg-line" aria-hidden />
            <span className="truncate text-[16px] font-bold">{state.examTitle}</span>
          </div>
          <div className="inline-flex h-8 items-center rounded-full bg-canvas px-3.5 text-[13px] font-semibold text-ink-soft">
            {question
              ? `Question ${question.number} / ${state.total}`
              : showFeedback
                ? "Correction"
                : "Enregistrement…"}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            {state.practice ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-lilac px-3 text-primary-strong">
                Entraînement · correction après chaque question
              </span>
            ) : isFullscreen ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-success-bg px-3 text-success">
                <ShieldCheck className="size-4" aria-hidden /> Mode sécurisé
              </span>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-bg px-3 text-warning">
                <ShieldAlert className="size-4" aria-hidden /> Hors mode examen
              </span>
            )}
            {!state.practice ? (
              <span
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3",
                  state.violationCount > 0
                    ? "bg-warning-bg text-warning"
                    : "bg-neutral-bg text-neutral",
                )}
              >
                Sorties : {state.violationCount}
              </span>
            ) : null}
            {!state.practice ? (
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                aria-expanded={helpOpen}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-lilac px-3 text-primary-strong hover:bg-primary-wash"
              >
                <MessageCircleQuestion className="size-4" aria-hidden /> Question au formateur
              </button>
            ) : null}
            {online ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-neutral-bg px-3 text-neutral">
                <Wifi className="size-4" aria-hidden /> Connecté
              </span>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-danger-bg px-3 text-danger">
                <WifiOff className="size-4" aria-hidden /> Connexion perdue
              </span>
            )}
          </div>
        </div>
        <div
          className="h-1.5 bg-line-soft"
          role="progressbar"
          aria-label={
            globalTimer ? "Temps restant pour l'examen" : "Temps restant pour la question"
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={cn(
              "h-1.5 transition-[width] duration-300 ease-linear",
              timeTone === "normal"
                ? "bg-primary"
                : timeTone === "warn"
                  ? "bg-warning-fill"
                  : "bg-danger-fill",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      {!online ? (
        <div
          className="bg-danger-bg px-8 py-2 text-center text-sm font-semibold text-danger"
          role="alert"
        >
          Connexion perdue : le chrono est en pause et la question masquée. Vos réponses sont
          gardées ; vous reprendrez sur cette même question, avec le temps qui vous restait, dès le
          retour du réseau.
        </div>
      ) : null}

      {latestAnswer ? (
        <div
          className="flex items-start justify-center gap-3 bg-success-bg px-8 py-2.5 text-sm text-ink-soft"
          role="status"
          aria-live="polite"
        >
          <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p className="max-w-3xl">
            <strong className="text-success">Réponse du formateur : </strong>
            {latestAnswer.answer}
            <span className="text-muted"> (à « {latestAnswer.message} »)</span>
          </p>
          <button
            type="button"
            onClick={() => setDismissedAnswers((d) => [...d, latestAnswer.id])}
            className="rounded-full p-0.5 text-muted hover:bg-surface"
            aria-label="Masquer la réponse"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {helpOpen && !state.finished ? (
        <HelpPanel
          attemptId={attemptId}
          help={help}
          onSent={setHelp}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}

      {message ? (
        <div
          className="flex items-start justify-center gap-3 bg-lilac px-8 py-2.5 text-sm text-ink-soft"
          role="status"
          aria-live="polite"
        >
          <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="max-w-3xl">
            <strong className="text-primary-strong">Message du formateur : </strong>
            {message.text}
          </p>
          <button
            type="button"
            onClick={() => setDismissedMessageAt(message.at)}
            className="rounded-full p-0.5 text-muted hover:bg-surface"
            aria-label="Masquer le message"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {extraNotice ? (
        <div
          key={extraNotice.id}
          className="flex items-center justify-center gap-2 bg-success-bg px-8 py-2 text-sm font-semibold text-success"
          role="status"
        >
          <Timer className="size-4" aria-hidden />
          Le formateur vous a accordé{" "}
          {extraNotice.seconds >= 60
            ? `${Math.round(extraNotice.seconds / 60)} min`
            : `${extraNotice.seconds} s`}{" "}
          de plus {globalTimer ? "pour l'examen" : "pour cette question"}.
        </div>
      ) : null}

      <main
        className={cn(
          "relative mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-8",
          isAlgo ? "max-w-[1440px]" : "max-w-[1120px]",
        )}
      >
        {/* Progression (non cliquable) */}
        <div className="flex items-center gap-4">
          <div className="flex flex-1 gap-1" aria-hidden>
            {state.progress.map((cell, i) => (
              <span key={i} className={cn("h-2 flex-1 rounded-full", CELL_CLASS[cell])} />
            ))}
          </div>
          <span className="text-[13px] font-semibold text-muted tabular-nums">
            {Math.round(
              (state.progress.filter((c) => c !== "upcoming" && c !== "current").length /
                Math.max(1, state.total)) *
                100,
            )}{" "}
            %
          </span>
        </div>

        {showFeedback && state.feedback ? (
          <PracticeFeedbackCard
            feedback={state.feedback}
            total={state.total}
            finished={state.finished}
            busy={busy}
            onContinue={() => void continuePractice()}
          />
        ) : question && !maskQuestion ? (
          <>
            <section className="flex flex-col gap-6 rounded-panel border border-line bg-surface p-8 shadow-soft max-sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-lilac px-3 text-[13px] font-semibold text-primary-strong">
                    {isText ? (
                      <PenLine className="size-4" aria-hidden />
                    ) : isAlgo ? (
                      <Code2 className="size-4" aria-hidden />
                    ) : (
                      <ListChecks className="size-4" aria-hidden />
                    )}
                    {isText
                      ? "Réponse à rédiger"
                      : isAlgo
                        ? "Algorithme à écrire"
                        : question.multiple
                          ? "Plusieurs réponses possibles"
                          : "Une seule réponse"}
                  </span>
                  <span className="inline-flex h-7 items-center rounded-full bg-neutral-bg px-3 text-[13px] font-semibold text-neutral">
                    {question.points} point{question.points > 1 ? "s" : ""}
                  </span>
                </div>
                {/* Chrono */}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-card border px-4 py-2.5",
                    timeTone === "normal" && "border-line bg-canvas text-ink",
                    timeTone === "warn" && "border-[#fcd9a4] bg-warning-bg text-warning",
                    timeTone === "danger" && "border-[#f6caca] bg-danger-bg text-danger",
                  )}
                >
                  <Clock className="size-6" aria-hidden />
                  <div className="leading-tight">
                    <div className="text-[30px] font-bold tabular-nums" aria-live="off">
                      {shownMs === null ? "—" : formatClock(shownMs)}
                    </div>
                    <div className="text-xs text-muted">
                      {globalTimer
                        ? `temps restant · examen (${formatClock(duration)})`
                        : `sur ${formatClock(duration)}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac text-[17px] font-bold text-primary">
                  {question.number}
                </span>
                <h1 className="pt-1.5 text-[22px] leading-snug font-semibold whitespace-pre-line">
                  {question.prompt}
                </h1>
              </div>

              {question.code && (!isAlgo || isText) ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="soft"
                      aria-label="Réduire le texte du code"
                      onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                    >
                      A−
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      aria-label="Agrandir le texte du code"
                      onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                    >
                      A+
                    </Button>
                  </div>
                  <CodeBlock
                    code={question.code}
                    language={question.codeLanguage}
                    fontSize={fontSize}
                  />
                </div>
              ) : null}

              {isAlgo ? (
                <p className="flex items-start gap-2 rounded-[12px] bg-lilac px-4 py-2.5 text-sm text-primary-strong">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {isText
                    ? state.settings.algoValidation
                      ? "Votre réponse sera corrigée après la remise : chaque élément juste rapporte des points. La note sera affichée une fois validée par votre formateur."
                      : "Votre réponse sera corrigée automatiquement après la remise : chaque élément juste rapporte des points."
                    : state.settings.algoValidation
                      ? "Votre algorithme sera corrigé après la remise : chaque partie juste rapporte des points. La note sera affichée une fois validée par votre formateur."
                      : "Votre algorithme sera corrigé automatiquement après la remise : chaque partie juste rapporte des points."}
                </p>
              ) : null}
              {isText ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    value={code}
                    onChange={(e) => editCode(e.target.value)}
                    readOnly={busy || timeUp}
                    rows={12}
                    maxLength={20_000}
                    spellCheck
                    aria-label="Votre réponse"
                    placeholder="Rédigez votre réponse ici…"
                    onPaste={(e) => {
                      if (state.settings.blockCopyPaste && !state.practice) e.preventDefault();
                    }}
                    className="min-h-[260px] w-full resize-y rounded-[14px] border border-line bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink outline-none read-only:bg-canvas focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <span className="self-end text-xs text-muted tabular-nums">
                    {code.trim() ? code.trim().split(/\s+/).length : 0} mot
                    {code.trim().split(/\s+/).length > 1 ? "s" : ""}
                  </span>
                </div>
              ) : isAlgo ? (
                <AlgoPlayground
                  value={code}
                  onChange={editCode}
                  readOnly={busy || timeUp}
                  blockPaste={state.settings.blockCopyPaste && !state.practice}
                  minRows={14}
                />
              ) : null}

              <div
                hidden={isAlgo}
                className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4"
                role={question.multiple ? "group" : "radiogroup"}
                aria-label="Réponses"
              >
                {question.options.map((o, i) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role={question.multiple ? "checkbox" : "radio"}
                      aria-checked={on}
                      disabled={busy || timeUp}
                      onClick={() => toggle(o.id)}
                      className={cn(
                        "flex min-h-[76px] w-full items-center gap-4 rounded-card border bg-surface px-5 py-3 text-left transition-all duration-150",
                        on
                          ? "border-primary bg-primary-wash shadow-[0_0_0_1px_var(--color-primary)]"
                          : "border-line hover:border-[#b8c6fb] hover:bg-[#fafbff]",
                        (busy || timeUp) && "opacity-70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
                          on ? "bg-primary text-white" : "bg-canvas text-ink-soft",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 text-[17px] font-medium whitespace-pre-line text-ink">
                        {o.label}
                      </span>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center border-2",
                          question.multiple ? "rounded-md" : "rounded-full",
                          on ? "border-primary bg-primary text-white" : "border-[#c6cede]",
                        )}
                        aria-hidden
                      >
                        {on ? (
                          question.multiple ? (
                            <Check className="size-4" strokeWidth={3} />
                          ) : (
                            <span className="size-2.5 rounded-full bg-white" />
                          )
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-5">
                <div className="flex items-center gap-2 text-sm font-semibold" aria-live="polite">
                  {saveStatus === "saving" ? (
                    <span className="flex items-center gap-2 text-muted">
                      <LoaderCircle className="size-4 animate-spin" aria-hidden /> Enregistrement…
                    </span>
                  ) : confirmAlgo ? (
                    <span className="text-warning">
                      Validation définitive : votre {isText ? "réponse" : "algorithme"} ne sera plus
                      modifiable
                      {isLast ? " et votre copie sera remise." : "."}
                    </span>
                  ) : confirmFinish ? (
                    <span className="text-warning">
                      Remise définitive : vous ne pourrez plus modifier vos réponses.
                    </span>
                  ) : saveStatus === "saved" ? (
                    <span className="flex items-center gap-2 text-success">
                      <Check className="size-4" strokeWidth={3} aria-hidden />{" "}
                      {isText
                        ? "Réponse enregistrée"
                        : isAlgo
                          ? "Algorithme enregistré"
                          : "Réponse enregistrée"}
                    </span>
                  ) : saveStatus === "error" ? (
                    <span className="flex items-center gap-2 text-danger">
                      <CircleAlert className="size-4" aria-hidden />{" "}
                      {isAlgo
                        ? "Réponse pas encore enregistrée sur le serveur : gardez cette page ouverte, il sera envoyé à la validation."
                        : "Non enregistrée, nouvel essai à la reconnexion"}
                    </span>
                  ) : timeUp ? (
                    <span className="text-muted">Temps écoulé…</span>
                  ) : isAlgo ? (
                    <span className="font-normal text-muted">
                      {isText
                        ? "Enregistrement automatique · pas de retour en arrière"
                        : "« Exécuter » pour tester · enregistrement automatique · pas de retour en arrière"}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">
                      1 à {question.options.length} (ou A à{" "}
                      {String.fromCharCode(64 + question.options.length)}) pour choisir · Entrée
                      pour valider · pas de retour en arrière
                    </span>
                  )}
                </div>
                <Button
                  size="lg"
                  variant={confirmSkip ? "danger" : "mint"}
                  disabled={busy || timeUp}
                  onClick={() => void goNext()}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="animate-spin" aria-hidden />
                      {online ? "Validation…" : "Reconnexion…"}
                    </>
                  ) : confirmSkip ? (
                    "Passer sans répondre ?"
                  ) : confirmAlgo ? (
                    <>
                      Confirmer la validation <Check aria-hidden />
                    </>
                  ) : confirmFinish ? (
                    <>
                      Confirmer la remise <Check aria-hidden />
                    </>
                  ) : (
                    <>
                      {isLast ? "Valider et terminer" : "Question suivante"}{" "}
                      <ArrowRight aria-hidden />
                    </>
                  )}
                </Button>
              </footer>
            </section>
          </>
        ) : question ? (
          <div className="flex flex-col gap-4" aria-hidden>
            <div className="h-80 rounded-[20px] bg-line-soft" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 rounded-[14px] bg-line-soft" />
              <div className="h-16 rounded-[14px] bg-line-soft" />
            </div>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 py-24 text-muted">
            <LoaderCircle className="size-5 animate-spin" aria-hidden />{" "}
            {booting ? "Chargement de la question…" : "Enregistrement de vos réponses…"}
          </p>
        )}
      </main>

      {/* Examen ouvert ailleurs : cet onglet n'a pas la main. */}
      {elsewhere && !state.finished ? (
        <Overlay>
          <span className="flex size-18 items-center justify-center self-center rounded-full bg-danger-bg text-danger">
            <ShieldAlert className="size-8" aria-hidden />
          </span>
          <div className="text-center">
            <h2 className="mb-2 font-display text-2xl font-bold">Examen ouvert ailleurs</h2>
            <p className="text-muted">
              Cet examen est déjà ouvert sur un autre appareil ou dans un autre onglet. Un seul
              accès à la fois est autorisé. Fermez l&apos;autre fenêtre : vous pourrez reprendre ici
              environ 30 secondes après. Le chrono continue.
            </p>
            <p className="mt-3 text-sm text-muted">
              Chaque reprise sur un autre appareil est signalée à votre formateur.
            </p>
          </div>
          <Button
            size="lg"
            variant="mint"
            className="w-full"
            onClick={() => attemptApi.state(attemptId).then(applyState, handleError)}
          >
            Réessayer ici
          </Button>
        </Overlay>
      ) : null}

      {/* Hors plein écran : la question est masquée, le chrono continue. */}
      {!elsewhere && !isFullscreen && !state.practice && !sanction && !state.finished ? (
        <Overlay>
          <span className="flex size-18 items-center justify-center self-center rounded-full bg-warning-bg text-warning">
            <Maximize className="size-8" aria-hidden />
          </span>
          <div className="text-center">
            <h2 className="mb-2 font-display text-2xl font-bold">Mode examen requis</h2>
            <p className="text-muted">
              La question est masquée tant que vous n&apos;êtes pas en plein écran.
              {question && remainingMs !== null ? (
                <strong className="text-ink">
                  {" "}
                  Le chrono continue : {formatClock(remainingMs)} restantes.
                </strong>
              ) : null}
            </p>
            <p className="mt-3 text-sm text-muted">
              La prochaine sortie sur cette question {NEXT_SANCTION_TEXT[state.nextSanction]}.
            </p>
          </div>
          <Button size="lg" variant="mint" className="w-full" onClick={enterFullscreen}>
            <Maximize aria-hidden /> Revenir en mode examen
          </Button>
        </Overlay>
      ) : null}

      {/* Sanction appliquée */}
      {sanction ? (
        <Overlay>
          <span
            className={cn(
              "flex size-18 items-center justify-center self-center rounded-full",
              sanction.type === "AVERTISSEMENT" || sanction.type === "AUCUNE"
                ? "bg-warning-bg text-warning"
                : "bg-danger-bg text-danger",
            )}
          >
            <ShieldAlert className="size-8" aria-hidden />
          </span>
          <div className="text-center">
            <p className="text-sm font-bold text-muted">
              Sortie n°{sanction.violationNumber} sur cette question
            </p>
            <h2 className="mb-2 font-display text-2xl font-bold">
              {SANCTION_TEXT[sanction.type].title}
            </h2>
            <p className="text-muted">{SANCTION_TEXT[sanction.type].body}</p>
            {!state.finished ? (
              <p className="mt-3 text-sm text-muted">
                La prochaine sortie sur cette question {NEXT_SANCTION_TEXT[state.nextSanction]}.
              </p>
            ) : null}
          </div>
          <Button
            size="lg"
            variant="mint"
            className="w-full"
            onClick={() => {
              setSanction(null);
              if (!state.finished && !document.fullscreenElement) void enterFullscreen();
            }}
          >
            {state.finished ? "Voir mon reçu" : "Reprendre l'examen"}
          </Button>
          <p className="text-center text-xs text-muted">
            Cet événement est transmis à votre formateur, qui peut le réviser.
          </p>
        </Overlay>
      ) : null}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-[70px] bottom-0 z-30 flex items-center justify-center bg-[#1f2340]/55 p-6">
      <section
        role="alertdialog"
        aria-modal="true"
        className="flex w-full max-w-[540px] flex-col gap-5 rounded-panel bg-surface p-9 shadow-pop"
      >
        {children}
      </section>
    </div>
  );
}

/** Question au formateur : texte libre, réponses affichées en bandeau. */
function HelpPanel({
  attemptId,
  help,
  onSent,
  onClose,
}: {
  attemptId: string;
  help: HelpItem[];
  onSent: (help: HelpItem[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (text.trim().length < 2 || sending) return;
    setSending(true);
    setError(null);
    try {
      onSent(await attemptApi.help(attemptId, text.trim()));
      setText("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible, réessayez.");
    } finally {
      setSending(false);
    }
  };
  return (
    <aside className="fixed right-6 bottom-6 z-20 flex w-[360px] max-w-[calc(100vw-48px)] flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-pop">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <MessageCircleQuestion className="size-4 text-primary" aria-hidden /> Question au
          formateur
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted hover:bg-canvas"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted">
        Le chrono continue. Le formateur répond depuis son tableau de suivi.
      </p>
      {help.length ? (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm">
          {help.map((h) => (
            <li key={h.id} className="rounded-field bg-canvas px-3 py-2">
              <p>{h.message}</p>
              <p className={cn("mt-1 text-xs", h.answer ? "text-success" : "text-muted")}>
                {h.answer ? `Réponse : ${h.answer}` : "En attente de réponse…"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Ex. : la question 4 semble avoir deux bonnes réponses."
        aria-label="Votre question"
        className="w-full resize-none rounded-field border border-line px-3 py-2 text-sm outline-none select-text focus:border-primary"
      />
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
      <Button size="sm" onClick={() => void send()} disabled={sending || text.trim().length < 2}>
        {sending ? "Envoi…" : "Envoyer"}
      </Button>
    </aside>
  );
}
