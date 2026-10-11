import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Liste déroulante native stylée (accessible au clavier, aucune dépendance). */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-field border border-[#e2e8f0] bg-surface pr-10 pl-3.5 text-[14px] font-medium text-ink",
          "focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] focus:outline-none",
          "disabled:opacity-60 aria-invalid:border-danger-fill",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}
