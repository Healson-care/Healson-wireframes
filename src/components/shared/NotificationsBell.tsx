"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { cn, formatDateHe } from "@/lib/utils";
import { Appointment, DsrRequest, ProviderProfile } from "@/types";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  href?: string;
  tone: "info" | "warning" | "danger" | "success";
}

const TONE_DOT: Record<AppNotification["tone"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

/** Header notification bell + drawer, shared by the provider portal and the
 * admin area. Notifications are derived on the fly from store state (there is
 * no persisted event log in this mock app) — each builder below maps the
 * current state to the items a real event feed would contain. */
export function NotificationsBell({ notifications }: { notifications: AppNotification[] }) {
  return (
    <DropdownMenu
      trigger={
        <span className="relative block rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="התראות">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              {notifications.length}
            </span>
          )}
        </span>
      }
    >
      <div className="w-80 max-w-[85vw]">
        <p className="border-b border-slate-100 px-3.5 pb-2 pt-1 text-xs font-semibold text-slate-500">התראות</p>
        {notifications.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-sm text-slate-400">אין התראות חדשות</p>
        ) : (
          notifications.map((n) => {
            const inner = (
              <span className="flex w-full items-start gap-2.5">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[n.tone])} />
                <span className="min-w-0 flex-1 text-right">
                  <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                  {n.description && <span className="mt-0.5 block text-xs text-slate-500">{n.description}</span>}
                </span>
              </span>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className="block px-3.5 py-2.5 hover:bg-slate-50">
                {inner}
              </Link>
            ) : (
              <div key={n.id} className="px-3.5 py-2.5">
                {inner}
              </div>
            );
          })
        )}
      </div>
    </DropdownMenu>
  );
}

export function buildProviderNotifications(
  provider: ProviderProfile | null | undefined,
  appointments: Appointment[]
): AppNotification[] {
  if (!provider) return [];
  const list: AppNotification[] = [];
  if (provider.status === "onboarding" && provider.rejection_reason) {
    list.push({
      id: "corrections",
      tone: "danger",
      title: "נדרשים תיקונים מצוות Healson",
      description: provider.rejection_reason,
      href: "/provider/dashboard",
    });
  }
  if (provider.status === "onboarding" && provider.go_live_requested_at) {
    list.push({
      id: "golive-wait",
      tone: "info",
      title: "בקשת הפרסום ממתינה לאישור Healson",
      description: `נשלחה ב-${formatDateHe(provider.go_live_requested_at)}`,
    });
  } else if (provider.status === "onboarding" && provider.onboarding_ready_at) {
    list.push({
      id: "ready",
      tone: "success",
      title: "הכל מוכן לפרסום",
      description: "נותר לשלוח בקשת פרסום לצוות Healson",
      href: "/provider/dashboard",
    });
  }
  if (provider.status === "approved" && !provider.bank_account?.verified_at) {
    list.push({
      id: "bank",
      tone: "warning",
      title: "חסרים פרטי חשבון בנק",
      description: "נדרשים כדי שנוכל להעביר אליך את התשלום החודשי",
      href: "/provider/profile/payments",
    });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter(
    (a) => a.provider_id === provider.id && a.status !== "בוטל" && a.date >= todayStr
  ).length;
  if (upcoming > 0) {
    list.push({
      id: "appointments",
      tone: "info",
      title: `${upcoming} תורים קרובים`,
      description: "לצפייה ואישור ביומן התורים",
      href: "/provider/appointments",
    });
  }
  return list;
}

const DSR_SLA_DAYS = 30;

export function buildAdminNotifications(
  providers: ProviderProfile[],
  dsrRequests: DsrRequest[]
): AppNotification[] {
  const list: AppNotification[] = [];
  const pendingReview = providers.filter((p) => p.status === "pending_review" && p.application_submitted_at).length;
  if (pendingReview > 0) {
    list.push({
      id: "pending-review",
      tone: "warning",
      title: `${pendingReview} בקשות ספק ממתינות לבדיקת רישיון`,
      description: "יעד הבדיקה המובטח לספקים: עד 24 שעות",
      href: "/providers",
    });
  }
  const goLive = providers.filter((p) => p.status === "onboarding" && p.go_live_requested_at).length;
  if (goLive > 0) {
    list.push({
      id: "go-live",
      tone: "info",
      title: `${goLive} ספקים ביקשו פרסום`,
      description: "ממתינים לאישור Go-Live סופי",
      href: "/providers",
    });
  }
  const breachedDsr = dsrRequests.filter(
    (r) =>
      (r.status === "ממתין" || r.status === "בטיפול") &&
      (Date.now() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60 * 24) > DSR_SLA_DAYS
  ).length;
  if (breachedDsr > 0) {
    list.push({
      id: "dsr-sla",
      tone: "danger",
      title: `${breachedDsr} בקשות פרטיות בחריגת SLA`,
      description: `עברו ${DSR_SLA_DAYS} יום ממועד הבקשה ללא טיפול`,
      href: "/admin",
    });
  }
  return list;
}
