"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

export function AuthLayout({
  children,
  onClose,
}: {
  children: ReactNode;
  /** Called instead of the default "/" navigation — used by multi-step
   * flows (e.g. /register) that need to clear a partial session first so
   * returning to the landing page shows it exactly as a fresh visitor would. */
  onClose?: () => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-slate-50 to-amber-50 p-4">
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/60 hover:text-slate-600"
        >
          <X className="h-4 w-4" /> <span className="hidden sm:inline">חזרה לדף הבית</span>
        </button>
      ) : (
        <Link
          href="/"
          className="absolute top-4 left-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/60 hover:text-slate-600"
        >
          <X className="h-4 w-4" /> <span className="hidden sm:inline">חזרה לדף הבית</span>
        </Link>
      )}
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
