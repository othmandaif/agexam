import type { Route } from "next";
import type { UserRole } from "@/domain/enums";

export const APP_NAME = "AGExam";

export const ROUTES = {
  login: "/connexion",
  account: {
    password: "/compte/mot-de-passe",
    pending: "/compte/en-attente",
  },
  student: {
    home: "/etudiant",
    training: "/etudiant/entrainement",
    homework: "/etudiant/devoirs",
  },
  trainer: {
    home: "/formateur",
    exams: "/formateur/examens",
    newExam: "/formateur/examens/nouveau",
    bank: "/formateur/banque",
    stats: "/formateur/statistiques",
    groups: "/formateur/groupes",
    students: "/formateur/etudiants",
    studentsImport: "/formateur/etudiants/import",
    training: "/formateur/entrainement",
    homework: "/formateur/devoirs",
  },
  admin: {
    home: "/admin",
    referential: "/admin/referentiel",
    accounts: "/admin/comptes",
    import: "/admin/comptes/import",
  },
} as const satisfies Record<string, Route | Record<string, Route>>;

/** Chemins dynamiques. */
export const paths = {
  module: (moduleId: string) => `/admin/referentiel/modules/${moduleId}` as Route,
  account: (userId: string) => `/admin/comptes/${userId}` as Route,
  group: (groupId: string) => `/formateur/groupes/${groupId}` as Route,
  exam: (examId: string) => `/formateur/examens/${examId}` as Route,
  editExam: (examId: string) => `/formateur/examens/${examId}/modifier` as Route,
  examMonitor: (examId: string) => `/formateur/examens/${examId}/suivi` as Route,
  examResults: (examId: string) => `/formateur/examens/${examId}/resultats` as Route,
  examGrading: (examId: string, all = false) =>
    `/formateur/examens/${examId}/resultats/corriger${all ? "?vue=toutes" : ""}` as Route,
  examCopy: (examId: string, attemptId: string) =>
    `/formateur/examens/${examId}/resultats/${attemptId}` as Route,
  examResultsExport: (examId: string) => `/api/v1/exams/${examId}/results/export`,
  examResultsGrid: (examId: string) => `/api/v1/exams/${examId}/results/grid`,
  studentsExport: (query = "") => `/api/v1/students/export${query ? `?${query}` : ""}`,
  examResultsPdf: (examId: string, query = "") =>
    `/api/v1/exams/${examId}/results/pdf${query ? `?${query}` : ""}`,
  examCopyPdf: (examId: string, attemptId: string) =>
    `/api/v1/exams/${examId}/copies/${attemptId}/pdf`,
  examAnswerSheets: (examId: string) => `/formateur/examens/${examId}/resultats/feuilles` as Route,
  studentReport: (studentId: string) => `/formateur/etudiants/${studentId}` as Route,
  track: (trackId: string) => `/formateur/entrainement/${trackId}` as Route,
  importExercises: (trackId: string) =>
    `/formateur/entrainement/${trackId}/exercices/importer` as Route,
  newExercise: (trackId: string) => `/formateur/entrainement/${trackId}/exercices/nouveau` as Route,
  exercise: (trackId: string, exerciseId: string) =>
    `/formateur/entrainement/${trackId}/exercices/${exerciseId}` as Route,
  studentTrack: (trackId: string) => `/etudiant/entrainement/${trackId}` as Route,
  studentExercise: (exerciseId: string) => `/etudiant/entrainement/exercice/${exerciseId}` as Route,
  homework: (homeworkId: string) => `/formateur/devoirs/${homeworkId}` as Route,
  newHomeworkStep: (homeworkId: string) =>
    `/formateur/devoirs/${homeworkId}/etapes/nouvelle` as Route,
  importHomeworkSteps: (homeworkId: string) =>
    `/formateur/devoirs/${homeworkId}/etapes/importer` as Route,
  homeworkStep: (homeworkId: string, stepId: string) =>
    `/formateur/devoirs/${homeworkId}/etapes/${stepId}` as Route,
  homeworkHandin: (homeworkId: string, studentId: string) =>
    `/formateur/devoirs/${homeworkId}/rendus/${studentId}` as Route,
  studentHomework: (homeworkId: string) => `/etudiant/devoirs/${homeworkId}` as Route,
  studentHomeworkStep: (stepId: string) => `/etudiant/devoirs/etape/${stepId}` as Route,
  bankQuestion: (questionId: string) => `/formateur/banque/${questionId}` as Route,
  /** Nouvel examen prérempli avec des questions de la banque. */
  newExamFromBank: (questionIds: string[]) =>
    `/formateur/examens/nouveau?questions=${questionIds.join(",")}` as Route,
};

export function homePathFor(role: UserRole): Route {
  switch (role) {
    case "ADMIN":
      return ROUTES.admin.home;
    case "FORMATEUR":
      return ROUTES.trainer.home;
    case "ETUDIANT":
      return ROUTES.student.home;
  }
}

/**
 * N'accepte que les chemins internes, pour éviter les redirections ouvertes.
 * Le chemin vient de l'URL (?next=…) : une page inexistante donnera simplement une 404.
 */
export function safeInternalPath(value: unknown): Route | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value as Route;
}
