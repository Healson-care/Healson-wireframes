import { HTMLAttributes } from "react";
import { BadgeCheck, Ban, Clock3, FileSignature, PauseCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderStatus, PROVIDER_STATUS_LABELS } from "@/types";

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

const PAYMENT_TONE: Record<string, Tone> = {
  "ממתין": "warning",
  "מקדמה שולמה": "info",
  "שולם במלואו": "success",
  "הוחזר": "neutral",
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
  kind: "appointment" | "order" | "patient" | "lead" | "referral" | "payment";
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
      : kind === "payment"
      ? PAYMENT_TONE
      : REFERRAL_TONE;
  return (
    <Badge tone={toneFor(map, status)} title={title}>
      {status}
    </Badge>
  );
}

// Single source of truth for provider lifecycle badges — every surface
// (provider dashboard hero, admin providers table, review dialog) renders the
// same tone/icon/label per status, matching the journey-map legend:
// pending=warning, onboarding=info, approved=success, rejected/suspended=danger.
const PROVIDER_STATUS_META: Record<ProviderStatus, { tone: Tone; icon: LucideIcon }> = {
  pending_review: { tone: "warning", icon: Clock3 },
  onboarding: { tone: "info", icon: FileSignature },
  approved: { tone: "success", icon: BadgeCheck },
  rejected: { tone: "danger", icon: Ban },
  suspended: { tone: "danger", icon: PauseCircle },
};

export function ProviderStatusBadge({ status, title }: { status: ProviderStatus; title?: string }) {
  const meta = PROVIDER_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} title={title}>
      <Icon className="h-3 w-3" /> {PROVIDER_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Companion badge for the publish flag — one word ("מפורסם"), one tone,
 * everywhere. */
export function ProviderPublishedBadge() {
  return <Badge tone="info">מפורסם</Badge>;
}
