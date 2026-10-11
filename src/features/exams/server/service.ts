import "server-only";
import { and, asc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { examPhase, canEditContent, publishProblems } from "@/domain/exam-lifecycle";
import type { TimerMode } from "@/domain/enums";
import { DEFAULT_SECURITY_SETTINGS } from "@/domain/exam-settings";
import {
  MAX_QUESTIONS_PER_EXAM,
  parseQuestionText,
  summarize,
  type ParsedQuestion,
} from "@/domain/question-text";
import { audit } from "@/server/audit";
import { generateAccessCode } from "@/server/auth/access-code";
import type { TenantUser } from "@/server/auth/session";
import { getDb, type Database } from "@/server/db/client";
import {
  attempts,
  examCandidates,
  examGroups,
  examQuestions,
  exams,
  groups,
  modules,
  profiles,
  questionVersions,
  questions,
} from "@/server/db/schema";
import { AppError, errors } from "@/server/http/errors";
import { assertCurrentYear } from "@/server/year";
import { questionFingerprint } from "@/server/questions/fingerprint";
import type { SaveExamInput } from "../schemas";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Examen que l'utilisateur peut gérer : son auteur, ou un admin de l'établissement. */
export async function getManageableExam(actor: TenantUser, examId: string) {
  const [exam] = await getDb()
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.establishmentId, actor.establishmentId)))
    .limit(1);
  if (!exam) throw errors.notFound("Examen introuvable.");
  if (actor.role !== "ADMIN" && exam.authorId !== actor.id) {
    throw errors.forbidden("Seul l'auteur de l'examen ou un administrateur peut le modifier.");
  }
  return exam;
}

/**
 * Examen modifiable : même contrôle d'accès, et seulement s'il appartient à
 * l'année scolaire courante (les années passées sont en consultation seule).
 */
export async function getEditableExam(actor: TenantUser, examId: string) {
  const exam = await getManageableExam(actor, examId);
  assertCurrentYear(exam.academicYear, "Cet examen");
  return exam;
}

export async function countAttempts(examId: string): Promise<number> {
  return getDb().$count(attempts, eq(attempts.examId, examId));
}

async function assertModuleInTenant(moduleId: string, establishmentId: string) {
  const [row] = await getDb()
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw errors.badRequest("Module introuvable.");
}

async function assertGroupsInTenant(groupIds: string[], establishmentId: string) {
  if (groupIds.length === 0) return;
  const rows = await getDb()
    .select({ id: groups.id })
    .from(groups)
    .where(and(inArray(groups.id, groupIds), eq(groups.establishmentId, establishmentId)));
  if (rows.length !== new Set(groupIds).size) throw errors.badRequest("Groupe introuvable.");
}

/**
 * Remplace les questions de l'examen par celles du texte.
 * Les questions créées par CET examen et utilisées nulle part ailleurs sont supprimées ;
 * celles partagées (examen dupliqué) sont conservées.
 */
async function replaceQuestions(
  tx: Tx,
  examId: string,
  parsed: ParsedQuestion[],
  ctx: { establishmentId: string; moduleId: string; authorId: string },
) {
  await tx.delete(examQuestions).where(eq(examQuestions.examId, examId));
  await tx.delete(questions).where(
    and(
      eq(questions.originExamId, examId),
      notExists(
        tx
          .select({ one: sql`1` })
          .from(examQuestions)
          .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
          .where(eq(questionVersions.questionId, questions.id)),
      ),
    ),
  );
  if (parsed.length === 0) return;

  // Banque : une question identique (même module, version actuelle, non archivée) est
  // réutilisée au lieu d'être recréée. Les statistiques la suivent d'un examen à l'autre.
  const prints = parsed.map((q) => questionFingerprint(q));
  const existing = await tx
    .select({ versionId: questionVersions.id, fingerprint: questionVersions.fingerprint })
    .from(questionVersions)
    .innerJoin(questions, eq(questions.id, questionVersions.questionId))
    .where(
      and(
        inArray(questionVersions.fingerprint, [...new Set(prints)]),
        eq(questions.establishmentId, ctx.establishmentId),
        eq(questions.moduleId, ctx.moduleId),
        isNull(questions.archivedAt),
        eq(questionVersions.version, questions.currentVersion),
      ),
    )
    .orderBy(asc(questions.createdAt));
  const reusable = new Map<string, string>();
  for (const e of existing) {
    if (e.fingerprint && !reusable.has(e.fingerprint)) reusable.set(e.fingerprint, e.versionId);
  }

  // Identifiants générés ici : l'ordre des lignes est garanti sans dépendre de RETURNING.
  const used = new Set<string>();
  const rows = parsed.map((q, i) => {
    const match = reusable.get(prints[i]!);
    // Deux fois la même question dans l'examen : la seconde est une nouvelle question.
    if (match && !used.has(match)) {
      used.add(match);
      return { q, versionId: match, questionId: null, fingerprint: prints[i]! };
    }
    return {
      q,
      versionId: crypto.randomUUID(),
      questionId: crypto.randomUUID(),
      fingerprint: prints[i]!,
    };
  });
  const created = rows.filter(
    (r): r is (typeof rows)[number] & { questionId: string } => r.questionId !== null,
  );

  if (created.length > 0) {
    await tx.insert(questions).values(
      created.map(({ questionId, q }) => ({
        id: questionId,
        establishmentId: ctx.establishmentId,
        moduleId: ctx.moduleId,
        authorId: ctx.authorId,
        type: q.type,
        suggestedDurationSec: q.durationSec,
        originExamId: examId,
      })),
    );
    await tx.insert(questionVersions).values(
      created.map(({ questionId, versionId, q, fingerprint }) => ({
        id: versionId,
        questionId,
        version: 1,
        prompt: q.prompt,
        code: q.code,
        codeLanguage: q.codeLanguage,
        explanation: q.explanation,
        defaultPoints: q.points,
        fingerprint,
        // Identifiants d'options aléatoires : ils ne trahissent pas l'ordre d'origine.
        options: q.options.map((o) => ({
          id: crypto.randomUUID().slice(0, 8),
          label: o.label,
          isCorrect: o.isCorrect,
          fixedPosition: o.fixedPosition,
        })),
      })),
    );
  }
  await tx.insert(examQuestions).values(
    rows.map(({ versionId, q }, index) => ({
      examId,
      questionVersionId: versionId,
      position: index,
      durationSec: q.durationSec,
      points: q.points,
    })),
  );
}

async function uniqueAccessCode(establishmentId: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateAccessCode();
    const taken = await getDb().$count(
      exams,
      and(eq(exams.establishmentId, establishmentId), eq(exams.accessCode, code)),
    );
    if (taken === 0) return code;
  }
  throw new AppError("INTERNAL", "Impossible de générer un code d'accès. Réessayez.");
}

/** Nom d'examen unique dans l'établissement (sans tenir compte de la casse). */
async function assertUniqueTitle(establishmentId: string, title: string, excludeId: string | null) {
  const taken = await getDb().$count(
    exams,
    and(
      eq(exams.establishmentId, establishmentId),
      sql`lower(${exams.title}) = lower(${title.trim()})`,
      excludeId ? sql`${exams.id} <> ${excludeId}` : undefined,
    ),
  );
  if (taken > 0)
    throw errors.conflict(
      `Un examen nommé « ${title.trim()} » existe déjà. Choisissez un autre nom.`,
    );
}

export interface SaveResult {
  examId: string;
  published: boolean;
}

async function assertStudentsInTenant(ids: string[], establishmentId: string) {
  if (ids.length === 0) return;
  const rows = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        inArray(profiles.id, ids),
        eq(profiles.establishmentId, establishmentId),
        eq(profiles.role, "ETUDIANT"),
      ),
    );
  if (rows.length !== new Set(ids).size) throw errors.badRequest("Étudiant introuvable.");
}

/** Crée ou met à jour un examen (brouillon ou publié). */
export async function saveExam(
  actor: TenantUser,
  rawInput: Omit<SaveExamInput, "candidateIds"> & { candidateIds?: string[] },
): Promise<SaveResult> {
  const input: SaveExamInput = { ...rawInput, candidateIds: rawInput.candidateIds ?? [] };
  const now = new Date();
  const parsed = parseQuestionText(input.sourceText);
  const summary = summarize(parsed);

  if (summary.questionCount > MAX_QUESTIONS_PER_EXAM) {
    throw errors.badRequest(`${MAX_QUESTIONS_PER_EXAM} questions maximum par examen.`);
  }
  await assertModuleInTenant(input.moduleId, actor.establishmentId);
  await assertGroupsInTenant(input.groupIds, actor.establishmentId);
  await assertStudentsInTenant(input.candidateIds, actor.establishmentId);

  const existing = input.examId ? await getEditableExam(actor, input.examId) : null;
  await assertUniqueTitle(actor.establishmentId, input.title, existing?.id ?? null);
  const attemptCount = existing ? await countAttempts(existing.id) : 0;
  const contentEditable = canEditContent(attemptCount);

  if (existing && !contentEditable && (existing.sourceText ?? "") !== input.sourceText) {
    throw errors.conflict("Des étudiants ont commencé : les questions ne sont plus modifiables.");
  }

  const wasPublished = existing ? existing.status !== "BROUILLON" : false;
  const willBePublished = input.intent === "publish" || wasPublished;

  // Un examen terminé ne repasse pas par les contrôles de publication (dates passées).
  const isClosed = existing ? examPhase(existing, now) === "FERME" : false;

  if (willBePublished && !isClosed) {
    const problems = publishProblems(
      {
        title: input.title,
        moduleId: input.moduleId,
        groupCount: input.groupIds.length + input.candidateIds.length,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        questionCount: summary.questionCount,
        questionErrorCount: summary.errorCount,
        totalDurationSec: summary.totalDurationSec,
        timerMode: input.settings.timerMode,
        globalDurationSec: input.settings.globalDurationSec,
      },
      now,
    );
    if (problems.length > 0) {
      throw new AppError("BAD_REQUEST", problems.join(" "), { problems });
    }
  }

  // Les questions ne sont enregistrées que si le texte est valide et le module choisi.
  const materialize = contentEditable && summary.errorCount === 0;

  const settingsColumns = {
    violationPolicy: input.settings.violationPolicy,
    isPractice: input.settings.isPractice,
    timerMode: input.settings.timerMode,
    globalDurationSec:
      input.settings.timerMode === "GLOBAL" ? input.settings.globalDurationSec : null,
    resultVisibility: input.settings.resultVisibility,
    resultReleaseMode: input.settings.resultReleaseMode,
    securitySettings: {
      ...(existing?.securitySettings ?? DEFAULT_SECURITY_SETTINGS),
      shuffleAnswers: input.settings.shuffleAnswers,
      blockCopyPaste: input.settings.blockCopyPaste,
    },
  };

  // Code généré dès le premier enregistrement (brouillon compris) : le formateur le connaît à l'avance.
  const accessCode = existing?.accessCode ?? (await uniqueAccessCode(actor.establishmentId));

  const examId = existing?.id ?? crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    const values = {
      title: input.title,
      description: input.description,
      moduleId: input.moduleId,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      sourceText: contentEditable ? input.sourceText : (existing?.sourceText ?? null),
      status: willBePublished ? (existing?.status === "FERME" ? "FERME" : "PLANIFIE") : "BROUILLON",
      accessCode,
      ...settingsColumns,
    } as const;

    if (existing) {
      await tx.update(exams).set(values).where(eq(exams.id, examId));
    } else {
      await tx.insert(exams).values({
        id: examId,
        establishmentId: actor.establishmentId,
        authorId: actor.id,
        ...values,
      });
    }

    await tx.delete(examGroups).where(eq(examGroups.examId, examId));
    if (input.groupIds.length > 0) {
      await tx
        .insert(examGroups)
        .values([...new Set(input.groupIds)].map((groupId) => ({ examId, groupId })));
    }
    await tx.delete(examCandidates).where(eq(examCandidates.examId, examId));
    if (input.candidateIds.length > 0) {
      await tx
        .insert(examCandidates)
        .values([...new Set(input.candidateIds)].map((profileId) => ({ examId, profileId })));
    }

    if (materialize) {
      await replaceQuestions(tx, examId, parsed.questions, {
        establishmentId: actor.establishmentId,
        moduleId: input.moduleId,
        authorId: actor.id,
      });
    } else if (contentEditable) {
      await replaceQuestions(tx, examId, [], {
        establishmentId: actor.establishmentId,
        moduleId: input.moduleId,
        authorId: actor.id,
      });
    }

    if (input.intent === "publish" && !wasPublished) {
      await audit(tx, {
        actorId: actor.id,
        action: "exam.publish",
        entityType: "exam",
        entityId: examId,
        payload: { questions: summary.questionCount, accessCode },
      });
    }
  });

  return { examId, published: willBePublished };
}

/** Repasse en brouillon (possible tant qu'aucun étudiant n'a commencé). */
export async function unpublishExam(actor: TenantUser, examId: string) {
  const exam = await getEditableExam(actor, examId);
  if (examPhase(exam, new Date()) === "FERME") {
    throw errors.conflict("Un examen terminé ne peut pas repasser en brouillon. Dupliquez-le.");
  }
  if ((await countAttempts(exam.id)) > 0) {
    throw errors.conflict("Des étudiants ont déjà commencé : impossible de repasser en brouillon.");
  }
  await getDb().update(exams).set({ status: "BROUILLON" }).where(eq(exams.id, exam.id));
}

async function totalDurationSec(exam: {
  id: string;
  timerMode: TimerMode;
  globalDurationSec: number | null;
}): Promise<number> {
  if (exam.timerMode === "GLOBAL") return exam.globalDurationSec ?? 0;
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${examQuestions.durationSec}), 0)::int` })
    .from(examQuestions)
    .where(eq(examQuestions.examId, exam.id));
  return row?.total ?? 0;
}

/**
 * Ouvre l'examen immédiatement. Si la fermeture prévue ne laisse pas le temps
 * de tout passer, elle est repoussée (durée totale + 15 min de marge).
 */
export async function openExamNow(actor: TenantUser, examId: string): Promise<Date> {
  const exam = await getEditableExam(actor, examId);
  const now = new Date();
  const phase = examPhase(exam, now);
  if (phase !== "PLANIFIE")
    throw errors.conflict("Seul un examen publié et pas encore ouvert peut être ouvert.");
  const minClose = new Date(now.getTime() + ((await totalDurationSec(exam)) + 15 * 60) * 1000);
  const closesAt = exam.closesAt && exam.closesAt > minClose ? exam.closesAt : minClose;
  await getDb().transaction(async (tx) => {
    await tx.update(exams).set({ opensAt: now, closesAt }).where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: actor.id,
      action: "exam.open_now",
      entityType: "exam",
      entityId: exam.id,
    });
  });
  return closesAt;
}

/** Ferme l'examen immédiatement : plus aucune nouvelle tentative. */
export async function closeExamNow(actor: TenantUser, examId: string) {
  const exam = await getEditableExam(actor, examId);
  if (exam.status === "BROUILLON") throw errors.conflict("Un brouillon n'est pas ouvert.");
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(exams)
      .set({
        status: "FERME",
        closesAt: exam.closesAt && exam.closesAt < now ? exam.closesAt : now,
      })
      .where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: actor.id,
      action: "exam.close_now",
      entityType: "exam",
      entityId: exam.id,
    });
  });
}

export async function regenerateAccessCode(actor: TenantUser, examId: string): Promise<string> {
  const exam = await getEditableExam(actor, examId);
  const code = await uniqueAccessCode(actor.establishmentId);
  await getDb().update(exams).set({ accessCode: code }).where(eq(exams.id, exam.id));
  return code;
}

/**
 * Copie un examen en brouillon : mêmes questions (partagées, non dupliquées),
 * mêmes groupes et réglages, sans dates ni code.
 */
export async function duplicateExam(actor: TenantUser, examId: string): Promise<string> {
  const source = await getManageableExam(actor, examId);
  const newId = crypto.randomUUID();
  await getDb().transaction(async (tx) => {
    await tx.insert(exams).values({
      id: newId,
      establishmentId: source.establishmentId,
      authorId: actor.id,
      moduleId: source.moduleId,
      title: `${source.title} (copie)`.slice(0, 160),
      description: source.description,
      sourceText: source.sourceText,
      status: "BROUILLON",
      maxAttempts: source.maxAttempts,
      isPractice: source.isPractice,
      timerMode: source.timerMode,
      globalDurationSec: source.globalDurationSec,
      violationPolicy: source.violationPolicy,
      securitySettings: source.securitySettings,
      resultVisibility: source.resultVisibility,
      resultReleaseMode: source.resultReleaseMode,
    });
    await tx.execute(sql`
      insert into ${examGroups} (exam_id, group_id)
      select ${newId}, group_id from ${examGroups} where exam_id = ${source.id}
    `);
    await tx.execute(sql`
      insert into ${examCandidates} (exam_id, profile_id)
      select ${newId}, profile_id from ${examCandidates} where exam_id = ${source.id}
    `);
    await tx.execute(sql`
      insert into ${examQuestions} (exam_id, question_version_id, position, duration_sec, points)
      select ${newId}, question_version_id, position, duration_sec, points
      from ${examQuestions} where exam_id = ${source.id}
    `);
  });
  return newId;
}

/** Supprime un examen sans tentative, et les questions qui n'appartenaient qu'à lui. */
/**
 * Supprime un examen sans copie. S'il a des copies, il est ARCHIVÉ : il sort
 * des listes et des statistiques, mais les résultats des stagiaires sont gardés
 * (jamais supprimés en silence) et l'examen peut être restauré.
 */
export async function deleteExam(
  actor: TenantUser,
  examId: string,
): Promise<{ archived: boolean; title: string }> {
  const exam = await getEditableExam(actor, examId);
  if ((await countAttempts(exam.id)) > 0) {
    const now = new Date();
    await getDb().transaction(async (tx) => {
      await tx
        .update(exams)
        .set({
          status: "ARCHIVE",
          // Un examen archivé n'accepte plus personne.
          closesAt: exam.closesAt && exam.closesAt < now ? exam.closesAt : now,
        })
        .where(eq(exams.id, exam.id));
      await audit(tx, {
        actorId: actor.id,
        action: "exam.archive",
        entityType: "exam",
        entityId: exam.id,
        payload: { title: exam.title },
      });
    });
    return { archived: true, title: exam.title };
  }
  await getDb().transaction(async (tx) => {
    await replaceQuestions(tx, exam.id, [], {
      establishmentId: exam.establishmentId,
      moduleId: exam.moduleId ?? "",
      authorId: actor.id,
    });
    await tx.delete(exams).where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: actor.id,
      action: "exam.delete",
      entityType: "exam",
      entityId: exam.id,
      payload: { title: exam.title },
    });
  });
  return { archived: false, title: exam.title };
}

/**
 * Suppression définitive d'un examen ARCHIVÉ : copies, réponses, incidents,
 * questions propres à l'examen. Irréversible ; réservée aux archives pour
 * qu'aucun résultat ne disparaisse sans étape volontaire préalable.
 */
export async function purgeExam(
  actor: TenantUser,
  examId: string,
): Promise<{ title: string; attempts: number }> {
  const exam = await getEditableExam(actor, examId);
  if (exam.status !== "ARCHIVE") {
    throw errors.conflict("Seul un examen archivé peut être supprimé définitivement.");
  }
  const attemptTotal = await countAttempts(exam.id);
  await getDb().transaction(async (tx) => {
    // Copies d'abord (réponses, événements, incidents, questions posées : en cascade).
    await tx.delete(attempts).where(eq(attempts.examId, exam.id));
    await replaceQuestions(tx, exam.id, [], {
      establishmentId: exam.establishmentId,
      moduleId: exam.moduleId ?? "",
      authorId: actor.id,
    });
    await tx.delete(exams).where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: actor.id,
      action: "exam.purge",
      entityType: "exam",
      entityId: exam.id,
      payload: { title: exam.title, attempts: attemptTotal },
    });
  });
  return { title: exam.title, attempts: attemptTotal };
}

/** Sort un examen des archives : il revient comme examen terminé. */
export async function restoreExam(actor: TenantUser, examId: string) {
  const exam = await getEditableExam(actor, examId);
  if (exam.status !== "ARCHIVE") throw errors.conflict("Cet examen n'est pas archivé.");
  await getDb().transaction(async (tx) => {
    await tx.update(exams).set({ status: "FERME" }).where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: actor.id,
      action: "exam.restore",
      entityType: "exam",
      entityId: exam.id,
    });
  });
}
