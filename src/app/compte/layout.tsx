import { Logo } from "@/components/brand/logo";

/** Pages de compte (mot de passe, attente) : centrées, sans navigation. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <main className="w-full max-w-[440px] rounded-panel border border-line bg-surface p-8 shadow-soft">
        {children}
      </main>
    </div>
  );
}
