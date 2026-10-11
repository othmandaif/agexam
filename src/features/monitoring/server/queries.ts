import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { examPhase } from "@/domain/exam-lifecycle";
import { DEFAULT_SECURITY_SETTINGS } from "@/domain/exam-settings";
import type { AttemptQuestionStatus } from "@/domain/enums";
import type { ProgressCell } from "@/features/attempts/types";
import { getDb } from "@/server/db/client";
import { enrolledIdsSql } from "@/server/db/enrolment";
import {
  attemptQuestions,
  attempts,
  exams,
  helpRequests,
  incidents,
  profiles,
  securityEvents,
} from "@/server/db/schema";
import type { AttemptTimeline, LiveStatus, MonitorData, MonitorStudent } from "../types";

const CELL: Record<AttemptQuestionStatus, ProgressCell> = {
  A_VENIR: "upcoming",
  EN_COURS: "current",
  REPONDUE: "answered",
  EXPIREE: "expired",
  INVALIDEE: "invalidated",
  NEUTRALISEE: "neutralized",
};

interface StudentRow {
  profile_id: string;
  full_name: string;
  email: string;
  attempt_id: string | null;
  status: string | null;
  violation_count: number | null;
  network_neutralizations: number | null;
  flagged_for_review: boolean | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  score_out_of_20: string | null;
  statuses: string | null;
  current_position: number | null;
  current_expires_at: string | null;
}

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

/** Tableau de suivi : tous les étudiants des groupes de l'examen, avec leur tentative la plus récente. */
export async function getMonitorData(examId: string): Promise<MonitorData> {
  const db = getDb();
  const now = new Date();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new Error("Examen introuvable.");
  const settings = { ...DEFAULT_SECURITY_SETTINGS, ...exam.securitySettings };
  const offlineAfterMs = settings.heartbeatIntervalSec * 2_500;

  const rows = (await db.execute(sql`
    select
      p.id as profile_id, p.full_name, p.email,
      a.id as attempt_id, a.status, a.violation_count, a.network_neutralizations,
      a.flagged_for_review, a.last_heartbeat_at, a.started_at, a.submitted_at, a.score_out_of_20,
      (select string_agg(aq.status::text, ',' order by aq.position)
         from ${attemptQuestions} aq where aq.attempt_id = a.id) as statuses,
      cq.position as current_position,
      cq.expires_at as current_expires_at
    from ${profiles} p
    join ${enrolledIdsSql(examId)} m on m.profile_id = p.id
    left join lateral (
      select * from ${attempts} x
      where x.exam_id = ${examId} and x.student_id = p.id and x.status <> 'ANNULEE'
      order by x.started_at desc
      limit 1
    ) a on true
    left join ${attemptQuestions} cq on cq.attempt_id = a.id and cq.status = 'EN_COURS'
    where p.role = 'ETUDIANT'
    order by p.full_name
  `)) as unknown as StudentRow[];

  const students: MonitorStudent[] = rows.map((r) => {
    const statuses = (r.statuses ? r.statuses.split(",") : []) as AttemptQuestionStatus[];
    let status: LiveStatus = "NOT_STARTED";
    if (r.status === "EN_COURS") {
      const lastSeen = r.last_heartbeat_at ? new Date(r.last_heartbeat_at).getTime() : 0;
      status = now.getTime() - lastSeen > offlineAfterMs ? "OFFLINE" : "IN_PROGRESS";
    } else if (r.status === "SOUMISE_AUTO") status = "AUTO_SUBMITTED";
    else if (r.status) status = "FINISHED";
    return {
      profileId: r.profile_id,
      fullName: r.full_name,
      email: r.email,
      attemptId: r.attempt_id,
      status,
      currentNumber: r.current_position !== null ? r.current_position + 1 : null,
      total: statuses.length,
      answered: statuses.filter((s) => s === "REPONDUE").length,
      cells: statuses.map((s) => CELL[s]),
      violationCount: r.violation_count ?? 0,
      neutralizations: r.network_neutralizations ?? 0,
      flagged: !!r.flagged_for_review,
      lastSeenAt: iso(r.last_heartbeat_at),
      currentExpiresAt: iso(r.current_expires_at),
      startedAt: iso(r.started_at),
      submittedAt: iso(r.submitted_at),
      scoreOutOf20: r.score_out_of_20 !== null ? Number(r.score_out_of_20) : null,
    };
  });

  const helpQuery = db
    .select({
      id: helpRequests.id,
      attemptId: helpRequests.attemptId,
      studentName: profiles.fullName,
      message: helpRequests.message,
      answer: helpRequests.answer,
      at: helpRequests.createdAt,
    })
    .from(helpRequests)
    .innerJoin(attempts, eq(attempts.id, helpRequests.attemptId))
    .innerJoin(profiles, eq(profiles.id, attempts.studentId))
    .where(eq(attempts.examId, examId))
    .orderBy(sql`${helpRequests.answeredAt} is not null`, desc(helpRequests.createdAt))
    .limit(50);

  const alertQuery = db
    .select({
      id: incidents.id,
      attemptId: incidents.attemptId,
      studentName: profiles.fullName,
      sanction: incidents.sanction,
      violationNumber: incidents.violationNumber,
      at: incidents.startedAt,
      revokedAt: incidents.revokedAt,
    })
    .from(incidents)
    .innerJoin(attempts, eq(attempts.id, incidents.attemptId))
    .innerJoin(profiles, eq(profiles.id, attempts.studentId))
    .where(eq(attempts.examId, examId))
    .orderBy(desc(incidents.startedAt))
    .limit(100);
  // Les deux lectures partent ensemble.
  const [alertRows, helpRows] = await Promise.all([alertQuery, helpQuery]);

  const count = (s: LiveStatus) => students.filter((x) => x.status === s).length;

  return {
    serverNow: now.toISOString(),
    exam: {
      id: exam.id,
      title: exam.title,
      phase: examPhase(exam, now),
      accessCode: exam.accessCode,
      opensAt: iso(exam.opensAt),
      closesAt: iso(exam.closesAt),
      liveMessage: exam.liveMessage,
      liveMessageAt: iso(exam.liveMessageAt),
      heartbeatIntervalSec: settings.heartbeatIntervalSec,
    },
    summary: {
      enrolled: students.length,
      notStarted: count("NOT_STARTED"),
      inProgress: count("IN_PROGRESS"),
      offline: count("OFFLINE"),
      finished: count("FINISHED") + count("AUTO_SUBMITTED"),
      activeAlerts: alertRows.filter((a) => !a.revokedAt).length,
    },
    students,
    alerts: alertRows.map((a) => ({
      id: a.id,
      attemptId: a.attemptId,
      studentName: a.studentName,
      sanction: a.sanction,
      violationNumber: a.violationNumber,
      at: a.at.toISOString(),
      revoked: !!a.revokedAt,
    })),
    help: helpRows.map((h) => ({ ...h, at: h.at.toISOString() })),
  };
}

/** Journal d'une tentative : événements navigateur et sanctions. */
export async function getAttemptTimeline(
  examId: string,
  attemptId: string,
): Promise<AttemptTimeline | null> {
  const db = getDb();
  const [attempt] = await db
    .select({ id: attempts.id, status: attempts.status })
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.examId, examId)))
    .limit(1);
  if (!attempt) return null;

  const positions = await db
    .select({ id: attemptQuestions.id, position: attemptQuestions.position })
    .from(attemptQuestions)
    .where(eq(attemptQuestions.attemptId, attemptId));
  const numberOf = new Map(positions.map((p) => [p.id, p.position + 1]));

  const [events, incidentRows] = await Promise.all([
    db
      .select()
      .from(securityEvents)
      .where(eq(securityEvents.attemptId, attemptId))
      .orderBy(desc(securityEvents.serverAt))
      .limit(300),
    db
      .select()
      .from(incidents)
      .where(eq(incidents.attemptId, attemptId))
      .orderBy(asc(incidents.startedAt)),
  ]);

  return {
    attemptId,
    status: attempt.status,
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      at: e.serverAt.toISOString(),
      questionNumber: e.attemptQuestionId ? (numberOf.get(e.attemptQuestionId) ?? null) : null,
      incidentId: e.incidentId,
    })),
    incidents: incidentRows.map((i) => ({
      id: i.id,
      violationNumber: i.violationNumber,
      sanction: i.sanction,
      questionNumber: i.attemptQuestionId ? (numberOf.get(i.attemptQuestionId) ?? null) : null,
      startedAt: i.startedAt.toISOString(),
      endedAt: iso(i.endedAt),
      revokedAt: iso(i.revokedAt),
    })),
  };
}
