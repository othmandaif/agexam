import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countAccountsByRole } from "@/features/accounts/server/queries";
import { getEstablishment, listModules } from "@/features/establishment/server/queries";
import { listGroups } from "@/features/groups/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Administration" };

function Stat({
  icon: Icon,
  value,
  label,
  href,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  href: Route;
}) {
  return (
    <Link href={href} className="flex-[1_1_200px] no-underline">
      <Card className="flex h-full items-center gap-4 p-5 text-ink transition-colors hover:border-primary">
        <span className="flex size-12 items-center justify-center rounded-full bg-lilac text-primary-strong">
          <Icon className="size-5" aria-hidden />
        </span>
        <span>
          <span className="block font-display text-2xl font-bold">{value}</span>
          <span className="block text-sm text-muted">{label}</span>
        </span>
      </Card>
    </Link>
  );
}

export default async function AdminHomePage() {
  const user = await requireTenant("ADMIN");
  const year = await getViewYear();
  const [establishment, counts, groupRows, moduleRows] = await Promise.all([
    getEstablishment(user.establishmentId),
    countAccountsByRole(user.establishmentId, year),
    listGroups(user.establishmentId, year),
    listModules(user.establishmentId),
  ]);

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard aria-hidden />}
        title={establishment?.name ?? "Administration"}
        description="Vue d'ensemble de l'établissement."
        actions={
          <Link href={ROUTES.admin.import} className={buttonVariants({ variant: "mint" })}>
            <Upload aria-hidden /> Importer des étudiants
          </Link>
        }
      />
      <div className="flex flex-wrap gap-4">
        <Stat
          icon={GraduationCap}
          value={counts.ETUDIANT}
          label="étudiants actifs"
          href={`${ROUTES.admin.accounts}?role=ETUDIANT` as Route}
        />
        <Stat
          icon={Presentation}
          value={counts.FORMATEUR}
          label="formateurs actifs"
          href={`${ROUTES.admin.accounts}?role=FORMATEUR` as Route}
        />
        <Stat icon={Users} value={groupRows.length} label="groupes" href={ROUTES.trainer.groups} />
        <Stat
          icon={BookOpen}
          value={moduleRows.length}
          label="modules"
          href={ROUTES.admin.referential}
        />
      </div>
    </>
  );
}
