import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "../actions";

export function SignOutButton({ tone = "default" }: { tone?: "default" | "inverse" }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        aria-label="Se déconnecter"
        title="Se déconnecter"
        className={cn(
          "flex size-10 items-center justify-center rounded-[10px] transition-colors",
          tone === "inverse"
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "text-muted hover:bg-[#f1f4f9] hover:text-ink",
        )}
      >
        <LogOut className="size-5" aria-hidden />
      </button>
    </form>
  );
}
