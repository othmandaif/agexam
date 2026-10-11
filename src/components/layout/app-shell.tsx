import { PastYearBanner, YearSwitcher } from "@/components/year/year-switcher";
import { currentAcademicYear } from "@/domain/academic-year";
import type { UserRole } from "@/domain/enums";
import { getViewYear, listAcademicYears } from "@/server/year";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

/** Structure formateur / admin : menu navy fixe + barre du haut + contenu. */
export async function AppShell({
  role,
  fullName,
  establishmentId,
  children,
}: {
  role: UserRole;
  fullName: string;
  establishmentId: string | null;
  children: React.ReactNode;
}) {
  const currentYear = currentAcademicYear();
  const [viewYear, years] = await Promise.all([
    getViewYear(),
    establishmentId ? listAcademicYears(establishmentId) : Promise.resolve([currentYear]),
  ]);
  return (
    <div className="flex min-h-screen">
      <AppSidebar role={role} fullName={fullName} />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar
          role={role}
          fullName={fullName}
          yearSwitcher={
            <YearSwitcher years={years} viewYear={viewYear} currentYear={currentYear} />
          }
        />
        {viewYear !== currentYear ? (
          <PastYearBanner viewYear={viewYear} currentYear={currentYear} />
        ) : null}
        <main className="animate-fade-in mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-7 px-8 pt-8 pb-14 max-sm:px-4">
          {children}
        </main>
      </div>
    </div>
  );
}
