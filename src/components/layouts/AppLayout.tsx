"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutGrid,
  Stethoscope,
  ShoppingCart,
  CalendarDays,
  Users,
  Settings,
  UserRound,
  GitBranch,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { SidebarDashboardSkeleton } from "@/components/ui/Skeleton";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useRequireRole } from "@/lib/useRequireRole";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "ראשי",
    items: [{ href: "/dashboard", label: "לוח בקרה", icon: Home }],
  },
  {
    label: "תפעול",
    items: [
      { href: "/appointments", label: "תורים", icon: CalendarDays },
      { href: "/orders", label: "הזמנות", icon: ShoppingCart },
      { href: "/providers", label: "ספקים", icon: Stethoscope },
      { href: "/catalog", label: "קטלוג", icon: LayoutGrid },
    ],
  },
  {
    label: "CRM",
    items: [{ href: "/crm", label: "מטופלים ולידים", icon: Users }],
  },
  {
    label: "ניהול",
    items: [
      { href: "/admin", label: "ניהול מערכת", icon: Settings },
      { href: "/import-doctors", label: "ייבוא ספקים", icon: UserRound },
      { href: "/import-catalog", label: "ייבוא קטלוג", icon: LayoutGrid },
    ],
  },
  {
    label: "כלים",
    items: [
      { href: "/journey", label: "מסע מטופל", icon: GitBranch },
      { href: "/medical", label: "מדריך רפואי", icon: BookOpen },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
const COMMAND_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })));

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const { ready, user } = useRequireRole("admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!ready || !user) {
    return <SidebarDashboardSkeleton />;
  }

  const activeLabel = ALL_ITEMS.find((i) => i.href === pathname)?.label;

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 border-l border-slate-200 bg-white transition-all duration-200",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              <Logo />
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <Logo showWordmark={false} />
            </Link>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center",
                        active ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-2 flex flex-col gap-0.5">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            {!collapsed && <span>כווץ תפריט</span>}
          </button>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>התנתק</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 bg-white shadow-lg flex flex-col animate-fade-slide-in">
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-500 rounded-md hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
                            active ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-slate-100 p-2">
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 w-full"
              >
                <LogOut className="h-4 w-4" />
                <span>התנתק</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
            <button className="lg:hidden p-1 text-slate-600" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Logo />
            </div>
            <span className="hidden lg:inline text-sm font-medium text-slate-700">{activeLabel ?? "ניהול"}</span>
            <div className="mr-auto flex items-center gap-3">
              <CommandPalette items={COMMAND_ITEMS} />
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                מנהל
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
