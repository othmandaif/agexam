import type { ExamPhase } from "@/domain/exam-lifecycle";
import type { SanctionType, SecurityEventType } from "@/domain/enums";
import type { ProgressCell } from "@/features/attempts/types";

export type LiveStatus = "NOT_STARTED" | "IN_PROGRESS" | "OFFLINE" | "FINISHED" | "AUTO_SUBMITTED";

export interface MonitorStudent {
  profileId: string;
  fullName: string;
  email: string;
  attemptId: string | null;
  status: LiveStatus;
  /** Numéro de la question en cours (1…n), null hors tentative en cours. */
  currentNumber: number | null;
  total: number;
  answered: number;
  cells: ProgressCell[];
  violationCount: number;
  neutralizations: number;
  flagged: boolean;
  lastSeenAt: string | null;
  currentExpiresAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  scoreOutOf20: number | null;
}

export interface MonitorAlert {
  id: string;
  attemptId: string;
  studentName: string;
  sanction: SanctionType;
  violationNumber: number;
  at: string;
  revoked: boolean;
}

export interface MonitorData {
  serverNow: string;
  exam: {
    id: string;
    title: string;
    phase: ExamPhase;
    accessCode: string | null;
    opensAt: string | null;
    closesAt: string | null;
    liveMessage: string | null;
    liveMessageAt: string | null;
    heartbeatIntervalSec: number;
  };
  summary: {
    enrolled: number;
    notStarted: number;
    inProgress: number;
    offline: number;
    finished: number;
    activeAlerts: number;
  };
  students: MonitorStudent[];
  alerts: MonitorAlert[];
  /** Questions des étudiants (non répondues d'abord). */
  help: MonitorHelp[];
}

export interface MonitorHelp {
  id: string;
  attemptId: string;
  studentName: string;
  message: string;
  answer: string | null;
  at: string;
}

export interface TimelineEvent {
  id: number;
  type: SecurityEventType;
  at: string;
  questionNumber: number | null;
  incidentId: string | null;
}

export interface TimelineIncident {
  id: string;
  violationNumber: number;
  sanction: SanctionType;
  questionNumber: number | null;
  startedAt: string;
  endedAt: string | null;
  revokedAt: string | null;
}

export interface AttemptTimeline {
  attemptId: string;
  status: string;
  events: TimelineEvent[];
  incidents: TimelineIncident[];
}
