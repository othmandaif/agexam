import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { createdAt, id, updatedAt } from "./_shared";
import { userRoleEnum } from "./enums";

/** Établissement (prêt pour le multi-établissement). */
export const establishments = pgTable("establishments", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Profil applicatif, 1–1 avec auth.users (Supabase Auth).
 * Le rôle est lu ICI, jamais dans les métadonnées modifiables par l'utilisateur.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    establishmentId: uuid("establishment_id").references(() => establishments.id, {
      onDelete: "set null",
    }),
    role: userRoleEnum("role").notNull().default("ETUDIANT"),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    /** Mot de passe provisoire : changement obligatoire à la prochaine connexion. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    /** Année scolaire active du compte étudiant (« 2026-2027 »). */
    academicYear: text("academic_year")
      .notNull()
      .default(sql`public.academic_year_of(now())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("profiles_establishment_idx").on(t.establishmentId, t.role)],
);

/** Module de formation, ex. « M104 · Algorithmique ». */
export const modules = pgTable(
  "modules",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("modules_code_uq").on(t.establishmentId, t.code)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: id(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("chapters_module_idx").on(t.moduleId, t.position)],
);

/** Groupe d'étudiants, ex. « DEV101 ». */
export const groups = pgTable(
  "groups",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    label: text("label"),
    /** Année scolaire du groupe : un « DEV101 » par année. */
    academicYear: text("academic_year")
      .notNull()
      .default(sql`public.academic_year_of(now())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("groups_name_year_uq").on(t.establishmentId, t.academicYear, t.name)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.profileId] }),
    index("group_members_profile_idx").on(t.profileId),
  ],
);
