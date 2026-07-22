import { FileEdit, ShieldCheck, FileSignature, Rocket, LayoutDashboard, Ban, PauseCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderProfile } from "@/types";

export type JourneyStageStatus = "done" | "active" | "pending" | "blocked";

export interface JourneyStage {
  key: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  status: JourneyStageStatus;
}

const STAGE_META: { key: string; label: string; sub: string; icon: LucideIcon }[] = [
  { key: "apply", label: "הרשמה", sub: "טופס בקשת הצטרפות", icon: FileEdit },
  { key: "review", label: "בדיקה ואישור", sub: 'אימות רישיון ע"י Healson', icon: ShieldCheck },
  { key: "onboarding", label: "הסכם ומחירון", sub: "חתימת הסכם Healson ← הסדרים וקטלוג פריטים", icon: FileSignature },
  { key: "publish", label: "פרסום", sub: "בקשת Go-Live ואישור Healson", icon: Rocket },
  { key: "live", label: "ניהול שוטף", sub: "יומן, מטופלים, דוחות", icon: LayoutDashboard },
];

/** Derives the 5-stage journey (§apply flow -> onboarding -> Go-Live -> live
 * management) from a single ProviderProfile — the one source of truth shared
 * by the provider-facing onboarding wizard and the admin review dialog, so
 * both surfaces always render the exact same stage as "current". */
export function computeProviderJourney(provider: ProviderProfile): JourneyStage[] {
  let reachedIndex = 0;
  if (provider.status === "pending_review") reachedIndex = 1;
  else if (provider.status === "onboarding") reachedIndex = provider.onboarding_ready_at ? 3 : 2;
  else if (provider.status === "approved") reachedIndex = 4;
  else if (provider.status === "suspended") reachedIndex = 4;
  else if (provider.status === "rejected") reachedIndex = provider.license_verified_at ? 2 : 1;

  return STAGE_META.map((meta, i) => {
    let status: JourneyStageStatus;
    if (provider.status === "rejected" && i === reachedIndex) status = "blocked";
    else if (provider.status === "suspended" && i === 4) status = "blocked";
    else if (i < reachedIndex) status = "done";
    else if (i === reachedIndex) status = "active";
    else status = "pending";
    return { ...meta, status };
  });
}

const STATUS_STYLES: Record<JourneyStageStatus, { circle: string; ring: string; text: string; line: string }> = {
  done: {
    circle: "bg-primary text-white border-primary",
    ring: "",
    text: "text-slate-700",
    line: "bg-primary",
  },
  active: {
    circle: "bg-white text-accent-text border-accent shadow-[0_0_0_5px_var(--color-accent-bg)]",
    ring: "animate-pulse",
    text: "text-accent-text font-semibold",
    line: "bg-neutral-border",
  },
  pending: {
    circle: "bg-white text-neutral-text border-neutral-border",
    ring: "",
    text: "text-neutral-text",
    line: "bg-neutral-border",
  },
  blocked: {
    circle: "bg-danger text-white border-danger",
    ring: "",
    text: "text-danger-text font-semibold",
    line: "bg-neutral-border",
  },
};

export function ProviderJourneyStepper({ provider, className }: { provider: ProviderProfile; className?: string }) {
  const stages = computeProviderJourney(provider);

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-border bg-gradient-to-l from-white via-white to-accent-bg/40 p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center overflow-x-auto pb-1">
        {stages.map((stage, i) => {
          const styles = STATUS_STYLES[stage.status];
          const Icon = stage.status === "blocked" ? (provider.status === "suspended" ? PauseCircle : Ban) : stage.icon;
          return (
            <div key={stage.key} className="flex flex-1 items-center min-w-[92px]">
              <div className="flex flex-col items-center gap-1.5 text-center min-w-[92px]">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    styles.circle,
                    styles.ring
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className={cn("text-xs leading-tight", styles.text)}>{stage.label}</p>
                <p className="hidden sm:block text-[10px] leading-tight text-neutral-text/70 max-w-[110px]">{stage.sub}</p>
              </div>
              {i < stages.length - 1 && (
                <div className={cn("mx-1 h-0.5 flex-1 rounded-full transition-colors", styles.line)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
