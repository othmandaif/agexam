import { relations } from "drizzle-orm";
import { attemptQuestions, attempts } from "./attempts";
import { examGroups, examQuestions, exams } from "./exams";
import { chapters, establishments, groupMembers, groups, modules, profiles } from "./organization";
import { questionVersions, questions } from "./questions";
import { incidents, securityEvents } from "./security";

export const establishmentsRelations = relations(establishments, ({ many }) => ({
  profiles: many(profiles),
  modules: many(modules),
  groups: many(groups),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  establishment: one(establishments, {
    fields: [profiles.establishmentId],
    references: [establishments.id],
  }),
  memberships: many(groupMembers),
  attempts: many(attempts),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  establishment: one(establishments, {
    fields: [modules.establishmentId],
    references: [establishments.id],
  }),
  chapters: many(chapters),
  questions: many(questions),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
  module: one(modules, { fields: [chapters.moduleId], references: [modules.id] }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  exams: many(examGroups),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  profile: one(profiles, { fields: [groupMembers.profileId], references: [profiles.id] }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  module: one(modules, { fields: [questions.moduleId], references: [modules.id] }),
  chapter: one(chapters, { fields: [questions.chapterId], references: [chapters.id] }),
  versions: many(questionVersions),
}));

export const questionVersionsRelations = relations(questionVersions, ({ one }) => ({
  question: one(questions, { fields: [questionVersions.questionId], references: [questions.id] }),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  module: one(modules, { fields: [exams.moduleId], references: [modules.id] }),
  author: one(profiles, { fields: [exams.authorId], references: [profiles.id] }),
  groups: many(examGroups),
  questions: many(examQuestions),
  attempts: many(attempts),
}));

export const examGroupsRelations = relations(examGroups, ({ one }) => ({
  exam: one(exams, { fields: [examGroups.examId], references: [exams.id] }),
  group: one(groups, { fields: [examGroups.groupId], references: [groups.id] }),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one }) => ({
  exam: one(exams, { fields: [examQuestions.examId], references: [exams.id] }),
  questionVersion: one(questionVersions, {
    fields: [examQuestions.questionVersionId],
    references: [questionVersions.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  exam: one(exams, { fields: [attempts.examId], references: [exams.id] }),
  student: one(profiles, { fields: [attempts.studentId], references: [profiles.id] }),
  questions: many(attemptQuestions),
  incidents: many(incidents),
  events: many(securityEvents),
}));

export const attemptQuestionsRelations = relations(attemptQuestions, ({ one }) => ({
  attempt: one(attempts, { fields: [attemptQuestions.attemptId], references: [attempts.id] }),
  examQuestion: one(examQuestions, {
    fields: [attemptQuestions.examQuestionId],
    references: [examQuestions.id],
  }),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  attempt: one(attempts, { fields: [incidents.attemptId], references: [attempts.id] }),
  events: many(securityEvents),
}));

export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  attempt: one(attempts, { fields: [securityEvents.attemptId], references: [attempts.id] }),
  incident: one(incidents, { fields: [securityEvents.incidentId], references: [incidents.id] }),
}));
