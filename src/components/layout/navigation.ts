import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Building2,
  Database,
  FileText,
  GraduationCap,
  Home,
  UserRound,
  Users,
} from "lucide-react";
import type { Route } from "next";
import type { UserRole } from "@/domain/enums";
import { ROUTES } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: Route;
  icon: LucideIcon;
  /** Correspondance exacte (sinon : préfixe). */
  exact?: boolean;
}

const trainerNav: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.trainer.home, icon: Home, exact: true },
  { label: "Examens", href: ROUTES.trainer.exams, icon: FileText },
  { label: "Banque de questions", href: ROUTES.trainer.bank, icon: Database },
  { label: "Statistiques", href: ROUTES.trainer.stats, icon: BarChart3 },
  { label: "Étudiants", href: ROUTES.trainer.students, icon: GraduationCap },
  { label: "Groupes", href: ROUTES.trainer.groups, icon: Users },
];

const adminNav: NavItem[] = [
  { label: "Vue d'ensemble", href: ROUTES.admin.home, icon: Building2, exact: true },
  { label: "Référentiel", href: ROUTES.admin.referential, icon: BookOpen },
  { label: "Comptes", href: ROUTES.admin.accounts, icon: UserRound },
  { label: "Groupes", href: ROUTES.trainer.groups, icon: Users },
  { label: "Examens", href: ROUTES.trainer.exams, icon: FileText },
  { label: "Banque de questions", href: ROUTES.trainer.bank, icon: Database },
  { label: "Statistiques", href: ROUTES.trainer.stats, icon: BarChart3 },
];

export function sidebarNavFor(role: UserRole): NavItem[] {
  return role === "ADMIN" ? adminNav : trainerNav;
}
