"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Mail,
  Fingerprint,
  CheckCircle2,
  Loader2,
  ScanLine,
  KeyRound,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { DEMO_PROVIDER_USER, SEED_PROVIDERS } from "@/lib/mock-data";

const demoProviderProfile = SEED_PROVIDERS.find((p) => p.user_id === DEMO_PROVIDER_USER.id);

const TRUST_BADGES = [
  { icon: Lock, label: "הצפנת AES-256" },
  { icon: ShieldCheck, label: "תואם ISO 27799" },
  { icon: Fingerprint, label: "אימות דו-שלבי" },
];

const VERIFY_STEPS = [
  "מאמת פרטי גישה",
  "מצפין ערוץ תקשורת (TLS 1.3)",
  "בודק הרשאות גישה לתיקי מטופלים",
  "טוען סביבת עבודה מאובטחת",
];

type Stage = "form" | "verifying" | "success";

export function SecureProviderLoginDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState(DEMO_PROVIDER_USER.email ?? "");
  const [password, setPassword] = useState("demo-secure-2026");
  const [stepIndex, setStepIndex] = useState(-1);

  function handleClose() {
    setStage("form");
    setStepIndex(-1);
    onClose();
  }

  useEffect(() => {
    if (stage !== "verifying") return;
    if (stepIndex >= VERIFY_STEPS.length - 1) {
      const t = setTimeout(() => setStage("success"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 420);
    return () => clearTimeout(t);
  }, [stage, stepIndex]);

  useEffect(() => {
    if (stage !== "success") return;
    const t = setTimeout(() => onComplete(), 1000);
    return () => clearTimeout(t);
  }, [stage, onComplete]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStage("verifying");
    setStepIndex(0);
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={stage === "form" ? handleClose : undefined}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-primary/50 px-6 pt-6 pb-8 text-center overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-primary/30 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
              <motion.div
                className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <ShieldCheck className="h-6 w-6" />
              </motion.div>
              <h2 className="relative mt-3 text-lg font-semibold text-white">כניסה מאובטחת לנותני שירות</h2>
              <p className="relative mt-1 text-xs text-white/60 leading-relaxed">
                פורטל ספקים — גישה מוצפנת לתיקי מטופלים ולנתונים רפואיים רגישים
              </p>
            </div>

            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {stage === "form" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {TRUST_BADGES.map((b) => (
                        <span
                          key={b.label}
                          className="flex items-center gap-1 rounded-full bg-info-bg border border-info-border px-2.5 py-1 text-[11px] font-medium text-info-text"
                        >
                          <b.icon className="h-3 w-3" /> {b.label}
                        </span>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                      <Input
                        type="email"
                        label="דוא״ל ספק"
                        icon={<Mail className="h-4 w-4" />}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Input
                        type="password"
                        label="סיסמה"
                        icon={<Lock className="h-4 w-4" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button type="submit" className="w-full mt-1">
                        <Lock className="h-4 w-4" /> כניסה מאובטחת
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-[11px] text-slate-400 leading-relaxed">
                      מצב הדגמה — הכניסה מדמה את זרימת האבטחה המלאה של פורטל ספקים רפואי, ללא חיבור אמיתי לשרת
                    </p>
                  </motion.div>
                )}

                {stage === "verifying" && (
                  <motion.div
                    key="verifying"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-3 py-2"
                  >
                    {VERIFY_STEPS.map((label, i) => {
                      const isDone = i < stepIndex;
                      const isCurrent = i === stepIndex;
                      return (
                        <div key={label} className="flex items-center gap-2.5 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : isCurrent ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                            )}
                          </span>
                          <span className={cn(isDone ? "text-slate-500" : isCurrent ? "text-slate-800 font-medium" : "text-slate-300")}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {stage === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center gap-2 py-3 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 16 }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success"
                    >
                      <ScanLine className="h-6 w-6" />
                    </motion.div>
                    <p className="font-semibold text-slate-900 mt-1">זוהית בהצלחה</p>
                    <p className="text-sm text-slate-600 flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                      {demoProviderProfile?.display_name ?? DEMO_PROVIDER_USER.full_name}
                      {demoProviderProfile?.specialty && ` · ${demoProviderProfile.specialty}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">מעביר אותך לפורטל הספק...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
