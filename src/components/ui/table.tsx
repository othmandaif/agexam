import { cn } from "@/lib/utils";

/** Tableau avec défilement horizontal sur petit écran. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-3 text-left text-[13px] font-bold whitespace-nowrap text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-line-soft px-4 py-3.5 align-middle", className)}
      {...props}
    />
  );
}
