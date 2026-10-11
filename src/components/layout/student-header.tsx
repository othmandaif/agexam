import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ROUTES } from "@/lib/routes";
import { initials } from "@/lib/utils";

export function StudentHeader({ fullName }: { fullName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-8 px-6">
        <Link href={ROUTES.student.home} aria-label="Accueil">
          <Logo />
        </Link>
        <nav aria-label="Navigation étudiant" className="flex h-full flex-1 gap-7">
          <Link
            href={ROUTES.student.home}
            aria-current="page"
            className="flex h-full items-center gap-2 border-b-2 border-primary text-[14px] font-semibold text-primary no-underline"
          >
            <ClipboardList className="size-[18px]" aria-hidden /> Mes examens
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold max-sm:hidden">{fullName}</span>
          <span className="flex size-9 items-center justify-center rounded-full bg-lilac text-sm font-bold text-primary">
            {initials(fullName)}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
