"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User as UserIcon, Phone, IdCard, Calendar } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { PatientTypeToggle } from "@/components/shared/PatientTypeToggle";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { isValidIsraeliId } from "@/lib/utils";
import { POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
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

type Phase = "credentials" | "otp" | "profile" | "consent" | "final-sms" | "final-email";

export default function RegisterPage() {
  const router = useRouter();
  const register = useStore((s) => s.register);
  const verifyOtp = useStore((s) => s.verifyOtp);
  const resendOtp = useStore((s) => s.resendOtp);
  const beginRegistrationVerification = useStore((s) => s.beginRegistrationVerification);
  const verifyRegistrationSmsOtp = useStore((s) => s.verifyRegistrationSmsOtp);
  const verifyRegistrationEmailLink = useStore((s) => s.verifyRegistrationEmailLink);
  const resendRegistrationOtp = useStore((s) => s.resendRegistrationOtp);
  const currentUser = useStore((s) => s.currentUser);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const logout = useStore((s) => s.logout);
  const completePatientRegistration = useStore((s) => s.completePatientRegistration);
  const patients = useStore((s) => s.patients);
  const showToast = useStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [finalSmsCode, setFinalSmsCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [consents, setConsents] = useState<ConsentValues>({});

  // A demo/lead user can already be authenticated (via loginAsDemo) without
  // ever having created credentials here — e.g. "מטופל חדש" in the internal
  // demo, or anyone gated from booking in /client/search. Redirect away if
  // they already have a patient profile; otherwise `effectivePhase` below
  // skips straight to profile completion instead of asking for email/
  // password again.
  const isUnregisteredLead =
    hasHydrated &&
    !!currentUser &&
    currentUser.role === "patient" &&
    !patients.some((p) => p.user_id === currentUser.id || p.email === currentUser.email);

  // completePatientRegistration (below) adds the patient record this effect
  // watches for — without this guard, finishing registration would flip
  // isUnregisteredLead to false and this effect would race handleFinish's
  // own navigation, always winning and stranding the user on /client
  // instead of wherever they were trying to book.
  const finishingRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !currentUser || finishingRef.current) return;
    if (currentUser.role === "patient" && !isUnregisteredLead) {
      router.replace("/client");
    }
  }, [hasHydrated, currentUser, isUnregisteredLead, router]);

  const effectivePhase: Phase = phase === "credentials" && isUnregisteredLead ? "profile" : phase;

  function handleClose() {
    // Registration isn't complete until completePatientRegistration runs
    // (handleFinish) — if the user is bailing out anywhere before that,
    // clear the partial session so the landing page shows itself exactly
    // as it does for a fresh visitor instead of staying stuck "logged in".
    if (currentUser) logout();
    router.push("/");
  }

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
    finishingRef.current = true;
    completePatientRegistration(
      currentUser.id,
      {
        full_name: fullName,
        phone,
        id_number: idNumber.trim(),
        date_of_birth: dateOfBirth,
        kupah: insurance.kupah || undefined,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
        address: insurance.address || undefined,
      },
      consents
    );
    const redirectTo = sessionStorage.getItem(POST_REGISTER_REDIRECT_KEY);
    sessionStorage.removeItem(POST_REGISTER_REDIRECT_KEY);
    showToast("ההרשמה הושלמה", { description: "ברוכים הבאים ל-HEALSON", variant: "success" });
    router.push(redirectTo || "/client");
  }

  function handleStartFinalVerification() {
    setError("");
    beginRegistrationVerification();
    setPhase("final-sms");
    const hint = resendRegistrationOtp("sms");
    showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
  }

  function handleVerifyFinalSms(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyRegistrationSmsOtp(finalSmsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setPhase("final-email");
      resendRegistrationOtp("email");
      showToast("שלחנו לך מייל עם קישור לאישור החשבון", { variant: "success" });
    }, 300);
  }

  // Clicking the (simulated) link in the confirmation card — no code to check.
  function handleConfirmFinalEmailLink() {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyRegistrationEmailLink();
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      handleFinish();
    }, 300);
  }

  function handleResendFinalSms() {
    const otp = resendRegistrationOtp("sms");
    if (otp) showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
  }

  function handleResendFinalEmail() {
    if (!resendRegistrationOtp("email")) return;
    showToast("שלחנו שוב מייל עם קישור לאישור החשבון");
  }

  if (effectivePhase === "otp") {
    return (
      <AuthLayout onClose={handleClose}>
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

  if (effectivePhase === "profile") {
    return (
      <AuthLayout onClose={handleClose}>
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

  if (effectivePhase === "consent") {
    const canFinish = areRequiredConsentsChecked(consents);
    return (
      <AuthLayout onClose={handleClose}>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">הסכמות</h1>
        <p className="text-sm text-slate-500 mb-5">אנא סמנו את ההסכמות הנדרשות כדי להמשיך</p>
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button className="w-full mt-4" disabled={!canFinish} onClick={handleStartFinalVerification}>
          סיום ההרשמה
        </Button>
      </AuthLayout>
    );
  }

  if (effectivePhase === "final-sms") {
    return (
      <AuthLayout onClose={handleClose}>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (1/2)</h1>
        <p className="text-sm text-slate-500 mb-5">
          לצורך אבטחת המידע הרפואי, נדרש אימות נוסף לפני סיום ההרשמה — קוד שנשלח ב-SMS וקוד נוסף באימייל.
        </p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerifyFinalSms} className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            label="קוד מ-SMS"
            value={finalSmsCode}
            onChange={(e) => setFinalSmsCode(e.target.value)}
            className="text-center tracking-[0.4em] text-lg"
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד SMS
          </Button>
          <button type="button" onClick={handleResendFinalSms} className="text-sm text-primary hover:underline">
            שלח קוד מחדש
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (effectivePhase === "final-email") {
    return (
      <AuthLayout onClose={handleClose}>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (2/2)</h1>
        <p className="text-sm text-slate-500 mb-5">שלחנו לך מייל עם קישור לאישור החשבון</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-medium">מייל הדגמה מ-HEALSON</span>
            </div>
            <p className="text-sm text-slate-700 mb-3">לחצו על הקישור הבא כדי לאשר את פרטי ההרשמה שלכם.</p>
            <Button type="button" onClick={handleConfirmFinalEmailLink} loading={loading} className="w-full">
              אשרו את החשבון שלי
            </Button>
          </div>
          <button type="button" onClick={handleResendFinalEmail} className="text-sm text-primary hover:underline">
            שלח קישור מחדש
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout onClose={handleClose}>
      <PatientTypeToggle active="new" />
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
