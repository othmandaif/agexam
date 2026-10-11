import { bigserial, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsz } from "./_shared";
import { attemptQuestions, attempts } from "./attempts";
import { sanctionTypeEnum, securityEventTypeEnum } from "./enums";
import { profiles } from "./organization";

/**
 * Incident = une violation après fusion des événements rapprochés.
 * Une sanction peut être annulée par le formateur (revokedAt).
 */
export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    attemptQuestionId: uuid("attempt_question_id").references(() => attemptQuestions.id, {
      onDelete: "set null",
    }),
    violationNumber: integer("violation_number").notNull(),
    sanction: sanctionTypeEnum("sanction").notNull(),
    startedAt: tsz("started_at").notNull().defaultNow(),
    endedAt: tsz("ended_at"),
    revokedAt: tsz("revoked_at"),
    revokedBy: uuid("revoked_by").references(() => profiles.id, { onDelete: "set null" }),
    revokeReason: text("revoke_reason"),
  },
  (t) => [index("incidents_attempt_idx").on(t.attemptId, t.startedAt)],
);

/** Journal brut des événements navigateur (append-only). */
export const securityEvents = pgTable(
  "security_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    attemptQuestionId: uuid("attempt_question_id").references(() => attemptQuestions.id, {
      onDelete: "set null",
    }),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    type: securityEventTypeEnum("type").notNull(),
    /** Heure déclarée par le client (indicative), l'heure serveur fait foi. */
    clientAt: tsz("client_at"),
    serverAt: tsz("server_at").notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [index("security_events_attempt_idx").on(t.attemptId, t.serverAt)],
);

/** Journal des actions sensibles (publication, neutralisation, annulation de sanction…). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

/** Question posée par un étudiant au formateur pendant l'examen, et sa réponse. */
export const helpRequests = pgTable(
  "help_requests",
  {
    id: id(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    answer: text("answer"),
    answeredAt: tsz("answered_at"),
    answeredBy: uuid("answered_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("help_requests_attempt_idx").on(t.attemptId, t.createdAt)],
);
