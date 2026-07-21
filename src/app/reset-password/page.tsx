"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { PasswordRequirements, passwordMeetsRequirements } from "@/components/shared/PasswordRequirements";

export default function ResetPasswordPage() {
  const router = useRouter();
  const resetPassword = useStore((s) => s.resetPassword);
  const pendingPasswordReset = useStore((s) => s.pendingPasswordReset);
  const showToast = useStore((s) => s.showToast);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Not reachable by just navigating to the URL — only a verified OTP
  // (started at /forgot-password) unlocks this screen, otherwise anyone
  // could reset anyone else's password with no identity check at all.
  useEffect(() => {
    if (!pendingPasswordReset?.verified) {
      router.replace("/forgot-password");
    }
  }, [pendingPasswordReset, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!passwordMeetsRequirements(password)) {
      setError("הסיסמה אינה עומדת בדרישות המפורטות מתחת לשדה");
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = resetPassword(password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באיפוס הסיסמה");
        return;
      }
      showToast("הסיסמה אופסה בהצלחה", { variant: "success" });
      router.push(pendingPasswordReset?.loginPath ?? "/login");
    }, 300);
  }

  if (!pendingPasswordReset?.verified) return null;

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">איפוס סיסמה</h1>
      <p className="text-sm text-slate-500 mb-5">בחרו סיסמה חדשה לחשבון שלכם</p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="password"
          placeholder="••••••••"
          label="סיסמה חדשה"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordRequirements password={password} />
        <Input
          type="password"
          placeholder="••••••••"
          label="אימות סיסמה"
          icon={<Lock className="h-4 w-4" />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          איפוס סיסמה
        </Button>
      </form>
    </AuthLayout>
  );
}
