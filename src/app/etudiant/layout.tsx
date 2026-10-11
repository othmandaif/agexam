import { StudentHeader } from "@/components/layout/student-header";
import { requireTenant } from "@/server/auth/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTenant("ETUDIANT");
  return (
    <div className="min-h-screen">
      <StudentHeader fullName={user.fullName} />
      <main className="animate-fade-in mx-auto flex max-w-[1240px] flex-col gap-6 px-6 pt-8 pb-16">
        {children}
      </main>
    </div>
  );
}
