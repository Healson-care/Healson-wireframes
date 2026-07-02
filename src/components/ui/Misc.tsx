import { ReactNode } from "react";
import { Loader2, Inbox, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-slate-400", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-slate-300">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-400 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-blue-400 to-indigo-600",
  "from-amber-400 to-orange-600",
  "from-fuchsia-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-blue-600",
  "from-violet-400 to-indigo-600",
  "from-lime-400 to-emerald-600",
];

function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-sm ring-2 ring-white",
        gradientForName(name),
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone = "slate",
  trend,
}: {
  label: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  tone?: "blue" | "amber" | "green" | "purple" | "indigo" | "rose" | "slate" | "success" | "warning" | "danger" | "info" | "neutral";
  /** Percentage change vs. the previous period, e.g. +12 or -8. */
  trend?: number;
}) {
  // Single source of truth: legacy raw-color names alias to the semantic tokens.
  const toneClasses: Record<string, string> = {
    blue: "bg-info-bg border-info-border text-info",
    info: "bg-info-bg border-info-border text-info",
    amber: "bg-warning-bg border-warning-border text-warning",
    warning: "bg-warning-bg border-warning-border text-warning",
    green: "bg-success-bg border-success-border text-success",
    success: "bg-success-bg border-success-border text-success",
    purple: "bg-purple-50 border-purple-100 text-purple-600",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
    rose: "bg-danger-bg border-danger-border text-danger",
    danger: "bg-danger-bg border-danger-border text-danger",
    slate: "bg-neutral-bg border-neutral-border text-neutral-text",
    neutral: "bg-neutral-bg border-neutral-border text-neutral-text",
  };
  return (
    <div className={cn("rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md", toneClasses[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {icon && <span>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              trend >= 0 ? "text-success" : "text-danger"
            )}
          >
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
