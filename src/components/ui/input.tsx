import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-field border border-[#e2e8f0] bg-surface px-3.5 text-[15px] text-ink transition-shadow",
        "focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] focus:outline-none",
        "disabled:bg-canvas disabled:opacity-70 aria-invalid:border-danger-fill",
        className,
      )}
      {...props}
    />
  );
}
