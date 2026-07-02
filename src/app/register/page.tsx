"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const register = useStore((s) => s.register);
  const verifyOtp = useStore((s) => s.verifyOtp);
  const resendOtp = useStore((s) => s.resendOtp);
  const showToast = useStore((s) => s.showToast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = register(email, password);
      setLoading(false);
      if (result.ok) {
        setShowOtp(true);
        showToast("קוד אימות נשלח", { description: `קוד הדגמה: ${result.otpHint}`, variant: "success" });
      }
    }, 300);
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyOtp(email, otpCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      router.push("/client");
    }, 300);
  }

  function handleResend() {
    const otp = resendOtp();
    if (otp) showToast("קוד חדש נשלח לאימייל", { description: `קוד הדגמה: ${otp}` });
  }

  if (showOtp) {
    return (
      <AuthLayout>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות קוד</h1>
        <p className="text-sm text-slate-500 mb-5">שלחנו קוד אימות בן 6 ספרות לכתובת {email}</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            label="קוד אימות"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="text-center tracking-[0.4em] text-lg"
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד
          </Button>
          <button type="button" onClick={handleResend} className="text-sm text-primary hover:underline">
            שלח קוד מחדש
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">יצירת חשבון</h1>
      <p className="text-sm text-slate-500 mb-5">הצטרפו לפלטפורמת HEALSON</p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="flex flex-col gap-3">
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
        <Input
          type="password"
          placeholder="••••••••"
          label="אימות סיסמה"
          icon={<Lock className="h-4 w-4" />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="w-full mt-1">
          צור חשבון
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        יש לך חשבון?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          התחבר
        </Link>
      </p>
    </AuthLayout>
  );
}
