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
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { getProfileSections } from "@/components/provider/profile-sections";

// Operational (daily-work) destinations only — profile configuration lives
// behind the "פרופיל" dropdown (getProfileSections), so there's exactly one
// visible top nav and no duplicated navigation.
const OPERATIONAL_NAV = [
  { href: "/provider/dashboard", label: "ראשי", icon: LayoutDashboard },
  { href: "/provider/patients", label: "מטופלים", icon: Users },
  { href: "/provider/appointments", label: "תורים", icon: CalendarDays },
  { href: "/provider/orders", label: "הזמנות", icon: ShoppingCart },
  { href: "/provider/referrals", label: "הפניות", icon: FileText },
];

export function ProviderLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const { ready, user } = useRequireRole("provider");
  const provider = useCurrentProvider();
  const appointments = useStore((s) => s.appointments);
  const notifications = buildProviderNotifications(provider, appointments);

  const status = provider?.status;
  const isPendingReview = ready && status === "pending_review";
  const isOnboarding = ready && status === "onboarding";
  const isApproved = ready && status === "approved";

  // The whole provider journey lives inside this one portal shell, and every
  // stage keeps the dashboard as its home: pending_review gets the dashboard
  // (where ProviderJourney shows the whole path) plus the application form,
  // onboarding gets the dashboard plus the profile-config pages where setup
  // happens. Crucially the setup pages (services/locations/availability) stay
  // unreachable until Healson verifies the license, and the operational nav
  // (patients/appointments/referrals) until approval (INV-SCOPE-GATE-01). A
  // freshly registered provider (PROV-REGISTRATION) already has a real session
  // while their license is reviewed, so they see the portal, not a wizard.
  const onDashboard = pathname === "/provider/dashboard";
  const onRegister = pathname === "/provider/register";
  const onProfile = pathname.startsWith("/provider/profile");
  const redirectingPending = isPendingReview && !onRegister && !onDashboard;
  const redirectingOnboarding = isOnboarding && !onDashboard && !onProfile;

  useEffect(() => {
    if (redirectingPending || redirectingOnboarding) router.replace("/provider/dashboard");
  }, [redirectingPending, redirectingOnboarding, router]);

  if (!ready || !user || redirectingPending || redirectingOnboarding) {
    return <DashboardSkeleton />;
  }

  // Operational nav: everything once approved, just the dashboard for the two
  // pre-approval stages — it's their home, and the only way back out of the
  // application form / setup pages.
  const operationalItems = isApproved
    ? OPERATIONAL_NAV
    : isOnboarding || isPendingReview
    ? OPERATIONAL_NAV.filter((i) => i.href === "/provider/dashboard")
    : [];
  // The full profile-management menu is for AFTER go-live — an approved
  // provider manages everything there. During onboarding the provider is guided
  // by the persistent onboarding meter (which links to each setup page), so the
  // free dropdown stays hidden to keep that stage focused.
  const showProfileMenu = isApproved;
  const profileSections = provider ? getProfileSections(getProviderSetupConfig(provider.provider_type)) : [];
  const commandItems = [
    ...operationalItems.map((item) => ({ ...item, group: "ניווט" })),
    ...(showProfileMenu ? profileSections.map((s) => ({ href: s.href, label: s.label, icon: s.icon, group: "פרופיל" })) : []),
  ];
  const mobileItems = [
    ...operationalItems,
    ...(showProfileMenu ? [{ href: "/provider/profile", label: "פרופיל", icon: UserRound }] : []),
  ];

  // Before the application is sent the request is a DRAFT — saying "בבדיקה"
  // there would be a lie (nothing was submitted yet) and is exactly what made
  // the stage confusing. `application_submitted_at` is the real divider.
  const applicationSubmitted = !!provider?.application_submitted_at;
  const stageBadge = isPendingReview
    ? applicationSubmitted
      ? "בקשה בבדיקה"
      : "בקשה בהכנה"
    : isOnboarding
    ? "השלמת הצטרפות"
    : "ספק";
  const stageBadgeClass = isApproved ? "bg-amber-100 text-amber-700" : "bg-info-bg text-info-text";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/provider/dashboard" className="flex items-center gap-2">
            <Logo />
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", stageBadgeClass)}>{stageBadge}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {operationalItems.map((item) => (
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
            {showProfileMenu && (
              <DropdownMenu
                trigger={
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      onProfile ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <UserRound className="h-4 w-4" /> פרופיל
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                }
              >
                {profileSections.map((s) => (
                  <DropdownMenuItem
                    key={s.href}
                    href={s.href}
                    className={pathname === s.href ? "bg-primary/5 text-primary" : undefined}
                  >
                    <s.icon className="h-4 w-4" /> {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenu>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {commandItems.length > 0 && <CommandPalette items={commandItems} />}
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
              {showProfileMenu && (
                <DropdownMenuItem href="/provider/profile">
                  <UserRound className="h-4 w-4" /> הפרופיל שלי
                </DropdownMenuItem>
              )}
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

      {mobileItems.length > 0 && (
        <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white md:hidden">
          <div className="flex items-stretch justify-around">
            {mobileItems.map((item) => {
              const active = item.href === "/provider/profile" ? onProfile : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium",
                    active ? "text-primary" : "text-slate-500"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
