"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { PatientTypeToggle } from "@/components/shared/PatientTypeToggle";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const loginAsDemo = useStore((s) => s.loginAsDemo);
  const currentUser = useStore((s) => s.currentUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  function goHome() {
    const user = useStore.getState().currentUser;
    router.push(user ? homeForRole(user.role) : "/login");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה בהתחברות");
        return;
      }
      goHome();
    }, 350);
  }

  function handleDemo(role: "admin" | "provider" | "patient", patientVariant?: "new" | "existing") {
    loginAsDemo(role, patientVariant);
    setTimeout(goHome, 50);
  }

  return (
    <AuthLayout>
      <PatientTypeToggle active="existing" />
      <h1 className="text-lg font-semibold text-slate-900 mb-1">התחברות</h1>
      <p className="text-sm text-slate-500 mb-5">היכנסו לחשבון שלכם כדי להמשיך</p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="email"
          placeholder="you@example.com"
          label="אימייל"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="••••••••"
          label="סיסמה"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            שכחת סיסמה?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full mt-1">
          התחברות
        </Button>
      </form>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setDemoOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          מצב הדגמה לצוות פנימי
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", demoOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {demoOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={() => handleDemo("patient", "new")}>
                  מטופל חדש
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("patient", "existing")}>
                  מטופל קיים
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("provider")}>
                  ספק
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("admin")}>
                  מנהל
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        אין לך חשבון?{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          צור חשבון
        </Link>
      </p>
      <p className="mt-1.5 text-center text-sm text-slate-500">
       נותן שירות?{" "}
        <Link href="/apply" className="text-primary font-medium hover:underline">
          הגישו בקשת הצטרפות כספק
        </Link>
      </p>
      {currentUser && (
        <p className="mt-2 text-center text-xs text-slate-400">מחובר כ-{currentUser.full_name}</p>
      )}
    </AuthLayout>
  );
}
