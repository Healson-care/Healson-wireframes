"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { ProviderConsentType } from "@/types";

/** Google's multi-color "G" mark, inlined so it works without a remote asset. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Demo-only "Continue with Google" entry point for providers. Signs in a fresh
 * demo provider (already past license-verification, in `onboarding`) via the
 * store, then shows a welcome modal that continues straight into the onboarding
 * wizard — the user is already authenticated, so there is no second login step.
 */
export function ProviderGoogleSignIn({
  label = "המשך עם Google",
  disabled,
  disabledHint,
  consents,
}: {
  label?: string;
  /** Set while the privacy consent gate above hasn't been satisfied. */
  disabled?: boolean;
  disabledHint?: string;
  /** Consent grants to record on the account this creates (see ProviderConsent). */
  consents?: { type: ProviderConsentType; granted: boolean }[];
}) {
  const router = useRouter();
  const loginWithGoogle = useStore((s) => s.loginWithGoogle);
  const recordProviderConsents = useStore((s) => s.recordProviderConsents);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  function handleClick() {
    if (disabled) return;
    loginWithGoogle();
    // loginWithGoogle creates/reuses the demo provider synchronously, so the
    // profile to attach the consents to exists by the time this line runs.
    const provider = useStore.getState().providers.find(
      (p) => p.user_id === useStore.getState().currentUser?.id
    );
    if (provider && consents?.length) recordProviderConsents(provider.id, consents);
    setWelcomeOpen(true);
  }

  // Straight to the portal home — the dashboard is where every stage of the
  // journey is driven from, including picking a provider type.
  function goToPortal() {
    router.push("/provider/dashboard");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleGlyph />
        {label}
      </button>
      {disabled && disabledHint && (
        <p className="mt-1.5 text-center text-[11px] text-slate-400">{disabledHint}</p>
      )}

      {/* Not dismissible into limbo: closing (X / backdrop) still continues to
          the application, since the account already exists and is signed in. */}
      <Dialog open={welcomeOpen} onClose={goToPortal}>
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="text-xl font-bold text-slate-900">ברוכים הבאים ל-Healson!</h2>
          <p className="mt-2 text-sm text-slate-500">החשבון שלך נוצר ואתם כבר מחוברים.</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
            נכנסים ישירות לפורטל שלכם. שם תבחרו את סוג הספק ותשלימו את פרטי הבקשה — בקצב שלכם, הכול נשמר,
            ושום דבר לא נשלח לבדיקה עד שתחליטו.
          </p>
          <Button className="mt-6 w-full" onClick={goToPortal}>
            כניסה לפורטל
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </Dialog>
    </>
  );
}
