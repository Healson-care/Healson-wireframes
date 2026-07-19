"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  ShoppingCart,
  UserRound,
  LogOut,
  Home,
  ChevronDown,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { NotificationsBell, buildProviderNotifications } from "@/components/shared/NotificationsBell";
import { Avatar } from "@/components/ui/Misc";
import { useRequireRole } from "@/lib/useRequireRole";
import { useCurrentProvider } from "@/lib/useCurrentPatient";

const NAV_ITEMS = [
  { href: "/provider/dashboard", label: "ראשי", icon: LayoutDashboard },
  { href: "/provider/patients", label: "מטופלים", icon: Users },
  { href: "/provider/appointments", label: "תורים", icon: CalendarDays },
  { href: "/provider/orders", label: "הזמנות", icon: ShoppingCart },
  { href: "/provider/referrals", label: "הפניות", icon: FileText },
  { href: "/provider/profile", label: "פרופיל", icon: UserRound },
];

const COMMAND_ITEMS = NAV_ITEMS.map((item) => ({ ...item, group: "ניווט" }));

export function ProviderLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const { ready, user } = useRequireRole("provider");
  const provider = useCurrentProvider();
  const appointments = useStore((s) => s.appointments);
  const notifications = buildProviderNotifications(provider, appointments);

  // Providers mid-onboarding get a limited-scope wizard only (INV-SCOPE-GATE-01)
  // — no calendar, patients, referrals, or lab access until Go-Live.
  const isOnboarding = ready && provider?.status === "onboarding";
  // A freshly-registered provider (PROV-REGISTRATION) already has a session
  // before Ops has verified their license — send them to the portal
  // registration wizard, which resumes wherever they left off (still filling
  // the form, or waiting for review) instead of showing the full provider nav.
  const isPendingReview = ready && provider?.status === "pending_review";

  useEffect(() => {
    if (isOnboarding) router.replace("/provider/onboarding");
    else if (isPendingReview) router.replace("/provider/register");
  }, [isOnboarding, isPendingReview, router]);

  if (!ready || !user || isOnboarding || isPendingReview) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/provider/dashboard" className="flex items-center gap-2">
            <Logo />
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">ספק</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
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
            <CommandPalette items={COMMAND_ITEMS} />
            <NotificationsBell notifications={notifications} />
            <Link href="/" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="דף הבית">
              <Home className="h-4 w-4" />
            </Link>
            <DropdownMenu
              trigger={
                <span className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100">
                  <Avatar name={provider?.display_name || user?.full_name || ""} src={provider?.image_url} className="h-8 w-8 text-xs" />
                  <span className="hidden sm:inline text-sm font-medium text-slate-700">{provider?.display_name || user?.full_name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </span>
              }
            >
              <DropdownMenuItem href="/provider/profile">
                <UserRound className="h-4 w-4" /> הפרופיל שלי
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
              >
                <LogOut className="h-4 w-4" /> התנתק
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 pb-24 md:pb-10">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white md:hidden">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.filter((i) => i.href !== "/provider/profile").map((item) => (
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
