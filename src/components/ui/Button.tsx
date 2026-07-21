"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Filled variants get a subtle top-to-bottom gradient + a tinted shadow in
// their own hue — that pairing is what gives buttons perceptible depth.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-primary to-primary-dark text-white shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/30 hover:brightness-105 hover:-translate-y-px",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-px hover:shadow-sm",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  destructive:
    "bg-gradient-to-b from-danger to-red-700 text-white shadow-sm shadow-danger/25 hover:shadow-md hover:shadow-danger/30 hover:brightness-105 hover:-translate-y-px",
  secondary:
    "bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-sm shadow-slate-900/25 hover:shadow-md hover:brightness-110 hover:-translate-y-px",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-lg",
  icon: "h-9 w-9 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:-translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
