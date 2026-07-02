import { ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-slate-50 to-amber-50 p-4">
      <div className="mb-6">
        <Logo size={40} className="text-xl" />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        {children}
      </div>
      <p className="mt-6 text-xs text-slate-400">פלטפורמת ניהול שירותי בריאות בישראל © 2026</p>
    </div>
  );
}
