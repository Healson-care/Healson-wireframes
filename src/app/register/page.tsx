"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User as UserIcon, Phone, IdCard, Calendar } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { isValidIsraeliId } from "@/lib/utils";
import {
  ConsentCheckboxes,
  ConsentValues,
  areRequiredConsentsChecked,
} from "@/components/patient/ConsentCheckboxes";
import {
  EMPTY_INSURANCE_PROFILE,
  InsuranceProfileForm,
  InsuranceProfileValue,
} from "@/components/patient/InsuranceProfileForm";

type Phase = "credentials" | "otp" | "profile" | "consent";

export default function RegisterPage() {
  const router = useRouter();
  const register = useStore((s) => s.register);
  const verifyOtp = useStore((s) => s.verifyOtp);
  const resendOtp = useStore((s) => s.resendOtp);
  const currentUser = useStore((s) => s.currentUser);
  const completePatientRegistration = useStore((s) => s.completePatientRegistration);
  const patients = useStore((s) => s.patients);
  const showToast = useStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [consents, setConsents] = useState<ConsentValues>({});

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
        setPhase("otp");
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
      setPhase("profile");
    }, 300);
  }

  function handleResend() {
    const otp = resendOtp();
    if (otp) showToast("קוד חדש נשלח לאימייל", { description: `קוד הדגמה: ${otp}` });
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidIsraeliId(idNumber)) {
      setError("מספר תעודת זהות לא תקין");
      return;
    }
    if (patients.some((p) => p.id_number === idNumber.trim())) {
      setError("תעודת זהות זו כבר רשומה במערכת");
      return;
    }
    setPhase("consent");
  }

  function handleFinish() {
    if (!currentUser) return;
    completePatientRegistration(
      currentUser.id,
      {
        full_name: fullName,
        phone,
        id_number: idNumber.trim(),
        date_of_birth: dateOfBirth,
        kupah: insurance.kupah,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
        address: insurance.address || undefined,
      },
      consents
    );
    router.push("/client");
  }

  if (phase === "otp") {
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

  if (phase === "profile") {
    return (
      <AuthLayout>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">פרטים ופרופיל ביטוחי</h1>
        <p className="text-sm text-slate-500 mb-5">נדרש לפני שמירת נתוני בריאות במערכת</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
          <Input label="שם מלא" icon={<UserIcon className="h-4 w-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input
            label="תעודת זהות"
            icon={<IdCard className="h-4 w-4" />}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            inputMode="numeric"
            maxLength={9}
            required
          />
          <Input
            label="תאריך לידה"
            type="date"
            icon={<Calendar className="h-4 w-4" />}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
          <Input label="טלפון נייד" icon={<Phone className="h-4 w-4" />} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <div className="h-px bg-slate-100 my-1" />
          <InsuranceProfileForm value={insurance} onChange={setInsurance} />
          <Button type="submit" className="w-full mt-2">
            המשך להסכמות
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (phase === "consent") {
    const canFinish = areRequiredConsentsChecked(consents);
    return (
      <AuthLayout>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">הסכמות</h1>
        <p className="text-sm text-slate-500 mb-5">אנא סמנו את ההסכמות הנדרשות כדי להמשיך</p>
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button className="w-full mt-4" disabled={!canFinish} onClick={handleFinish}>
          סיום ההרשמה
        </Button>
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
