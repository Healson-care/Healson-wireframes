"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Search,
  CalendarDays,
  FileText,
  UserRound,
  LogOut,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/Badge";
import { ClientLayoutSkeleton } from "@/components/ui/Skeleton";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useRequireRole } from "@/lib/useRequireRole";
import { useCurrentPatient } from "@/lib/useCurrentPatient";

const NAV_ITEMS = [
  { href: "/client", label: "אזור אישי", icon: LayoutDashboard },
  { href: "/client/search", label: "חיפוש", icon: Search },
  { href: "/client/appointments", label: "התורים שלי", icon: CalendarDays },
  { href: "/client/documents", label: "מסמכים", icon: FileText },
  { href: "/client/profile", label: "פרופיל", icon: UserRound },
];

const COMMAND_ITEMS = NAV_ITEMS.map((item) => ({ ...item, group: "ניווט" }));

// Small notification-style count badge overlaid on a nav icon — currently
// only "מסמכים" uses it, for documents still waiting on the patient.
function NavIcon({ Icon, count, className }: { Icon: typeof FileText; count: number; className: string }) {
  return (
    <span className="relative inline-flex">
      <Icon className={className} />
      {count > 0 && (
        <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {count}
        </span>
      )}
    </span>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const documents = useStore((s) => s.documents);
  const { ready, user } = useRequireRole("patient");
  const patient = useCurrentPatient();

  const pendingDocumentsCount = documents.filter(
    (d) => d.patient_id === patient?.id && d.status === "ממתין למילוי"
  ).length;

  // Role alone isn't enough — a lead (patient-role user with no Patient
  // record, e.g. the demo "מטופל חדש") must never see the personal area,
  // even via a direct URL. Send them to the public search instead.
  useEffect(() => {
    if (ready && user && !patient) {
      router.replace("/book");
    }
  }, [ready, user, patient, router]);

  if (!ready || !user || !patient) {
    return <ClientLayoutSkeleton />;
  }

  return (
    // The brand stage without /apply's ivory ground: on a screen the patient
    // returns to daily, the warm cream read as a colour rather than as paper.
    // A near-white slate keeps the navy cards and their long shadows floating,
    // which is what carried the look — the tint was never doing that work.
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 text-[var(--brand-ink)]">
      {/* Navy only — the gold glow was tinting the whole ground and reading as
          a gold page rather than as depth behind it. Gold stays a hairline on
          the hero, never an area of colour. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-brand-drift absolute -top-24 right-[-30%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(20,42,79,0.07),transparent_70%)] sm:right-[-12%] sm:h-[520px] sm:w-[520px]" />
        <div className="absolute bottom-[-10%] left-[-30%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(20,42,79,0.06),transparent_70%)] sm:left-[-8%] sm:h-[480px] sm:w-[480px]" />
      </div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/client">
            <Logo />
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <NavIcon
                  Icon={item.icon}
                  count={item.href === "/client/documents" ? pendingDocumentsCount : 0}
                  className="h-4 w-4"
                />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary sm:text-sm"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">חזרה לדף הבית</span>
            </Link>
            <Badge tone={patient ? "success" : "warning"} title={patient ? "יש רשומת מטופל מלאה" : "מחובר/ת בלי רשומת מטופל — טרם הושלמה הרשמה"}>
              {patient ? "מטופל רשום" : "ליד"}
            </Badge>
            <CommandPalette items={COMMAND_ITEMS} />
            <button
              onClick={() => {
                logout();
                router.push("/client/login");
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">התנתק</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 mx-auto w-full max-w-2xl px-4 py-6 pb-24 sm:pb-10">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white sm:hidden">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px] font-medium",
                pathname === item.href ? "text-primary" : "text-slate-500"
              )}
            >
              <NavIcon
                Icon={item.icon}
                count={item.href === "/client/documents" ? pendingDocumentsCount : 0}
                className="h-5 w-5"
              />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
