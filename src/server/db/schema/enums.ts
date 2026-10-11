import { pgEnum } from "drizzle-orm/pg-core";
import {
  ATTEMPT_QUESTION_STATUSES,
  ATTEMPT_STATUSES,
  CODE_LANGUAGES,
  DIFFICULTIES,
  EXAM_STATUSES,
  QUESTION_TYPES,
  RESULT_RELEASE_MODES,
  RESULT_VISIBILITIES,
  SANCTION_TYPES,
  SECURITY_EVENT_TYPES,
  TIMER_MODES,
  USER_ROLES,
} from "@/domain/enums";

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const questionTypeEnum = pgEnum("question_type", QUESTION_TYPES);
export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);
export const codeLanguageEnum = pgEnum("code_language", CODE_LANGUAGES);
export const examStatusEnum = pgEnum("exam_status", EXAM_STATUSES);
export const timerModeEnum = pgEnum("timer_mode", TIMER_MODES);
export const resultVisibilityEnum = pgEnum("result_visibility", RESULT_VISIBILITIES);
export const resultReleaseModeEnum = pgEnum("result_release_mode", RESULT_RELEASE_MODES);
export const attemptStatusEnum = pgEnum("attempt_status", ATTEMPT_STATUSES);
export const attemptQuestionStatusEnum = pgEnum(
  "attempt_question_status",
  ATTEMPT_QUESTION_STATUSES,
);
export const securityEventTypeEnum = pgEnum("security_event_type", SECURITY_EVENT_TYPES);
export const sanctionTypeEnum = pgEnum("sanction_type", SANCTION_TYPES);
