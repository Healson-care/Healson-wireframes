"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";

export default function ForgotPasswordPage() {
  const forgotPassword = useStore((s) => s.forgotPassword);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      forgotPassword(email);
      setLoading(false);
      setSent(true);
    }, 300);
  }

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">שכחת סיסמה?</h1>
      <p className="text-sm text-slate-500 mb-5">הזינו את כתובת האימייל שלכם כדי לקבל הוראות לאיפוס</p>

      {sent ? (
        <div className="rounded-lg bg-success-bg border border-success-border px-3 py-3 text-sm text-success-text">
          נשלח אימייל עם הוראות לאיפוס סיסמה ל-{email}. (מצב הדגמה — אין שליחה בפועל)
        </div>
      ) : (
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
          <Button type="submit" loading={loading} className="w-full">
            שלח קישור לאיפוס
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        <Link href="/login" className="text-primary font-medium hover:underline">
          חזרה להתחברות
        </Link>
      </p>
    </AuthLayout>
  );
}
