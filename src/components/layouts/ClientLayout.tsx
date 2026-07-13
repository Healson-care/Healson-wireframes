"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Search,
  CalendarDays,
  FlaskConical,
  Bell,
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
  { href: "/client", label: "בית", icon: Home },
  { href: "/client/search", label: "חיפוש", icon: Search },
  { href: "/client/appointments", label: "היסטוריית תורים", icon: CalendarDays },
  { href: "/client/reminders", label: "תזכורות", icon: Bell },
  { href: "/client/lab", label: "מעבדה", icon: FlaskConical },
  { href: "/client/profile", label: "פרופיל", icon: UserRound },
];

const COMMAND_ITEMS = NAV_ITEMS.map((item) => ({ ...item, group: "ניווט" }));

export function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const { ready, user } = useRequireRole("patient");
  const patient = useCurrentPatient();

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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
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
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Badge tone={patient ? "success" : "warning"} title={patient ? "יש רשומת מטופל מלאה" : "מחובר/ת בלי רשומת מטופל — טרם הושלמה הרשמה"}>
              {patient ? "מטופל רשום" : "ליד"}
            </Badge>
            <CommandPalette items={COMMAND_ITEMS} />
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">התנתק</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 pb-24 sm:pb-10">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white sm:hidden">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px] font-medium",
                pathname === item.href ? "text-primary" : "text-slate-500"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
