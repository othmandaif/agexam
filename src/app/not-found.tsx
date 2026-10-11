import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-6xl font-extrabold text-primary">404</p>
      <h1 className="font-display text-2xl font-bold">Page introuvable</h1>
      <p className="text-muted">Le lien est peut-être erroné ou la page n&apos;existe plus.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
