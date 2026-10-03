import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/ui/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-electric text-ink shadow-[0_0_0_1px_rgb(39_153_255/0.5),0_10px_40px_-12px_rgb(39_153_255/0.8)] hover:bg-[#4aaaff] hover:shadow-[0_0_0_1px_rgb(39_153_255/0.7),0_14px_50px_-10px_rgb(39_153_255/0.95)]",
  secondary: "border border-line-strong bg-white/[0.03] text-white hover:border-white/30 hover:bg-white/[0.07]",
  ghost: "text-fog hover:text-white hover:bg-white/[0.05]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.95rem]",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function buttonClasses({ variant = "primary", size = "md", className }: Omit<StyleProps, "children">) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  children,
  type = "button",
  ...props
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, ...props }: StyleProps & LinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
