import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent" | "purple" | "indigo";
// Legacy raw-color aliases kept so existing call sites across the app keep working
// while still resolving to the centralized semantic tokens.
type LegacyTone = "slate" | "green" | "amber" | "red" | "blue" | "rose";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone | LegacyTone;
}

const toneClasses: Record<Tone | LegacyTone, string> = {
  neutral: "bg-neutral-bg text-neutral-text border border-neutral-border",
  success: "bg-success-bg text-success-text border border-success-border",
  warning: "bg-warning-bg text-warning-text border border-warning-border",
  danger: "bg-danger-bg text-danger-text border border-danger-border",
  info: "bg-info-bg text-info-text border border-info-border",
  accent: "bg-accent-bg text-accent-text border border-accent-border",
  // Kept for statuses that need a distinct hue beyond the 4 semantic states (e.g. "in progress" vs "info")
  purple: "bg-purple-50 text-purple-700 border border-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  // Legacy aliases
  slate: "bg-neutral-bg text-neutral-text border border-neutral-border",
  green: "bg-success-bg text-success-text border border-success-border",
  amber: "bg-warning-bg text-warning-text border border-warning-border",
  red: "bg-danger-bg text-danger-text border border-danger-border",
  blue: "bg-info-bg text-info-text border border-info-border",
  rose: "bg-danger-bg text-danger-text border border-danger-border",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

const APPOINTMENT_TONE: Record<string, Tone> = {
  "ממתין לתשלום מקדמה": "warning",
  "מאושר": "info",
  "שולם במלואו": "purple",
  "בוצע": "success",
  "בוטל": "danger",
};

const ORDER_TONE: Record<string, Tone> = {
  "ממתין": "warning",
  "מאושר": "info",
  "בביצוע": "purple",
  "הושלם": "success",
  "בוטל": "danger",
};

const PATIENT_TONE: Record<string, Tone> = {
  "פעיל": "success",
  "לא פעיל": "neutral",
  "ממתין": "warning",
};

const LEAD_TONE: Record<string, Tone> = {
  "חדש": "info",
  "נוצר קשר": "purple",
  "מתוכנן": "indigo",
  "הומר": "success",
  "לא מעוניין": "neutral",
};

const REFERRAL_TONE: Record<string, Tone> = {
  "ממתין לעיבוד": "warning",
  "בעיבוד": "info",
  "הושלם": "success",
  "שגיאה": "danger",
};

function toneFor(map: Record<string, Tone>, status: string): Tone {
  return map[status] ?? "neutral";
}

export function StatusBadge({
  status,
  kind,
  title,
}: {
  status: string;
  kind: "appointment" | "order" | "patient" | "lead" | "referral";
  title?: string;
}) {
  const map =
    kind === "appointment"
      ? APPOINTMENT_TONE
      : kind === "order"
      ? ORDER_TONE
      : kind === "patient"
      ? PATIENT_TONE
      : kind === "lead"
      ? LEAD_TONE
      : REFERRAL_TONE;
  return (
    <Badge tone={toneFor(map, status)} title={title}>
      {status}
    </Badge>
  );
}
