import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] font-semibold no-underline transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Action principale de l'écran (une seule par écran). */
        mint: "bg-primary text-white shadow-[0_1px_2px_rgba(49,91,239,0.25)] hover:bg-primary-strong hover:shadow-[0_4px_12px_rgba(49,91,239,0.28)]",
        primary: "bg-primary text-white hover:bg-primary-strong",
        /** Secondaire : blanc, bordure discrète. */
        outline:
          "border border-[#e2e8f0] bg-surface text-ink hover:border-[#cbd5e1] hover:bg-[#f8fafc]",
        soft: "bg-primary-wash text-primary hover:bg-lilac",
        ghost: "bg-transparent text-muted hover:bg-[#f1f4f9] hover:text-ink",
        danger: "border border-[#f6caca] bg-surface text-danger hover:bg-danger-bg",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-[14px]",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Action en cours : spinner, bouton désactivé, aria-busy. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
