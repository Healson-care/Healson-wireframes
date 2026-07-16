"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User as UserIcon, Phone, IdCard, Calendar, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/shared/Stepper";
import { useStore } from "@/lib/store";
import { isValidIsraeliId } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/file";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";
import { UploadedFile } from "@/types";
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

type Mode = "new" | "existing";
type Phase =
  | "existing-form"
  | "new-credentials"
  | "new-profile"
  | "new-insurance"
  | "new-consent"
  | "otp-sms"
  | "otp-email";

const NEW_STEPS = ["פרטי התחברות", "פרטים אישיים", "פרופיל ביטוחי", "הסכמות", "אימות SMS", "אימות אימייל"];
const NEW_PHASE_INDEX: Partial<Record<Phase, number>> = {
  "new-credentials": 0,
  "new-profile": 1,
  "new-insurance": 2,
  "new-consent": 3,
  "otp-sms": 4,
  "otp-email": 5,
};

const GOOGLE_DEMO_NEW = {
  full_name: "נועה כהן",
  phone: "050-1234567",
  email: "noa@example.co.il",
  id_number: "123456782",
  date_of_birth: "1990-01-01",
  password: "demo1234",
};

const GOOGLE_DEMO_EXISTING = {
  email: "patient@demo.co.il",
  phone: "050-1234567",
  password: "demo1234",
};

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
}

export default function ClientLoginPage() {
  const router = useRouter();
  const showToast = useStore((s) => s.showToast);
  const patients = useStore((s) => s.patients);

  // New-patient registration
  const register = useStore((s) => s.register);
  const verifyOtp = useStore((s) => s.verifyOtp);
  const completePatientRegistration = useStore((s) => s.completePatientRegistration);
  const beginRegistrationVerification = useStore((s) => s.beginRegistrationVerification);
  const verifyRegistrationSmsOtp = useStore((s) => s.verifyRegistrationSmsOtp);
  const verifyRegistrationEmailOtp = useStore((s) => s.verifyRegistrationEmailOtp);
  const resendRegistrationOtp = useStore((s) => s.resendRegistrationOtp);

  // Existing-patient login
  const login = useStore((s) => s.login);
  const verifyLoginSmsOtp = useStore((s) => s.verifyLoginSmsOtp);
  const verifyLoginEmailOtp = useStore((s) => s.verifyLoginEmailOtp);
  const resendLoginOtp = useStore((s) => s.resendLoginOtp);

  const [mode, setMode] = useState<Mode>("new");
  const [phase, setPhase] = useState<Phase>("new-credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [emailCode, setEmailCode] = useState("");

  // New-patient form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<"id" | "passport">("id");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [consents, setConsents] = useState<ConsentValues>({});

  // Existing-patient form fields
  const [existingEmail, setExistingEmail] = useState("");
  const [existingPhone, setExistingPhone] = useState("");
  const [existingPassword, setExistingPassword] = useState("");

  const phoneForOtpDisplay = mode === "new" ? phone : existingPhone;
  const isMinor = (() => {
    const age = calcAge(dateOfBirth);
    return age !== null && age < 18;
  })();

  function switchMode(next: Mode) {
    setMode(next);
    setPhase(next === "new" ? "new-credentials" : "existing-form");
    setError("");
  }

  function fillGoogleDemo() {
    if (mode === "new") {
      setFullName(GOOGLE_DEMO_NEW.full_name);
      setPhone(GOOGLE_DEMO_NEW.phone);
      setEmail(GOOGLE_DEMO_NEW.email);
      setIdNumber(GOOGLE_DEMO_NEW.id_number);
      setDateOfBirth(GOOGLE_DEMO_NEW.date_of_birth);
      setPassword(GOOGLE_DEMO_NEW.password);
      setConfirmPassword(GOOGLE_DEMO_NEW.password);
      setInsurance((prev) => ({ ...prev, address: "הרצל 12, תל אביב" }));
    } else {
      setExistingEmail(GOOGLE_DEMO_EXISTING.email);
      setExistingPhone(GOOGLE_DEMO_EXISTING.phone);
      setExistingPassword(GOOGLE_DEMO_EXISTING.password);
    }
  }

  function handleCredentialsSubmit(e: React.FormEvent) {
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
      if (!result.ok) return;
      // The double SMS+email OTP at the end of this flow is the real
      // verification step the user sees — this just uses the existing
      // register/verifyOtp pair internally to create the account record,
      // without showing a redundant third (email-only) OTP screen.
      verifyOtp(email, result.otpHint);
      setPhase("new-profile");
    }, 300);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (documentType === "id" && !isValidIsraeliId(idNumber)) {
      setError("מספר תעודת זהות לא תקין");
      return;
    }
    if (documentType === "passport" && idNumber.trim().length < 4) {
      setError("מספר דרכון לא תקין");
      return;
    }
    if (patients.some((p) => p.id_number === idNumber.trim())) {
      setError(documentType === "id" ? "תעודת זהות זו כבר רשומה במערכת" : "מספר דרכון זה כבר רשום במערכת");
      return;
    }
    if (!idPhoto) {
      setError(`יש להעלות צילום של ${documentType === "id" ? "תעודת הזהות" : "הדרכון"}`);
      return;
    }
    if (isMinor && !parentName.trim()) {
      setError("יש להזין את שם ההורה עבור מטופל קטין");
      return;
    }
    setPhase("new-insurance");
  }

  function handleInsuranceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("new-consent");
  }

  function handleStartFinalVerification() {
    setError("");
    beginRegistrationVerification();
    setPhase("otp-sms");
    const hint = resendRegistrationOtp("sms");
    showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
  }

  async function finishNewRegistration() {
    const currentUser = useStore.getState().currentUser;
    if (!currentUser) return;
    let photo: UploadedFile | undefined;
    if (idPhoto) {
      photo = { file_name: idPhoto.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(idPhoto) };
    }
    completePatientRegistration(
      currentUser.id,
      {
        full_name: fullName,
        phone,
        id_number: idNumber.trim(),
        id_document_type: documentType,
        id_document_photo: photo,
        date_of_birth: dateOfBirth,
        parent_name: isMinor ? parentName.trim() || undefined : undefined,
        kupah: insurance.kupah,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
        address: insurance.address || undefined,
      },
      consents
    );
    showToast("ההרשמה הושלמה", { description: "ברוכים הבאים ל-HEALSON", variant: "success" });
    router.push("/client");
  }

  function handleExistingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(existingEmail, existingPassword);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה בהתחברות");
        return;
      }
      if (result.requiresOtp) {
        setPhase("otp-sms");
        const hint = resendLoginOtp("sms");
        showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
        return;
      }
      const user = useStore.getState().currentUser;
      router.push(user ? homeForRole(user.role) : "/login");
    }, 300);
  }

  function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = mode === "new" ? verifyRegistrationSmsOtp(smsCode) : verifyLoginSmsOtp(smsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setPhase("otp-email");
      const hint = mode === "new" ? resendRegistrationOtp("email") : resendLoginOtp("email");
      showToast("קוד אימות נשלח באימייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
    }, 300);
  }

  function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(async () => {
      if (mode === "new") {
        const result = verifyRegistrationEmailOtp(emailCode);
        setLoading(false);
        if (!result.ok) {
          setError(result.error ?? "שגיאה באימות");
          return;
        }
        await finishNewRegistration();
      } else {
        const result = verifyLoginEmailOtp(emailCode);
        setLoading(false);
        if (!result.ok) {
          setError(result.error ?? "שגיאה באימות");
          return;
        }
        const user = useStore.getState().currentUser;
        router.push(user ? homeForRole(user.role) : "/login");
      }
    }, 300);
  }

  function handleResendSms() {
    const otp = mode === "new" ? resendRegistrationOtp("sms") : resendLoginOtp("sms");
    if (otp) showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
  }

  function handleResendEmail() {
    const otp = mode === "new" ? resendRegistrationOtp("email") : resendLoginOtp("email");
    if (otp) showToast("קוד חדש נשלח באימייל", { description: `קוד הדגמה: ${otp}` });
  }

  const modeToggle = (
    <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => switchMode("new")}
        className={cn(
          "rounded-md py-2 text-sm font-medium transition-colors",
          mode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
      >
        מטופל חדש
      </button>
      <button
        type="button"
        onClick={() => switchMode("existing")}
        className={cn(
          "rounded-md py-2 text-sm font-medium transition-colors",
          mode === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
      >
        מטופל קיים
      </button>
    </div>
  );

  const errorBox = error && (
    <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
      {error}
    </div>
  );

  // ---- Shared OTP screens (both modes) ----
  if (phase === "otp-sms" || phase === "otp-email") {
    const stepIdx = mode === "new" ? NEW_PHASE_INDEX[phase] : undefined;
    return (
      <AuthLayout>
        {mode === "new" && stepIdx !== undefined && (
          <>
            <Stepper steps={NEW_STEPS} step={stepIdx} />
            <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[stepIdx]}</p>
          </>
        )}
        {phase === "otp-sms" ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (1/2)</h1>
            <p className="text-sm text-slate-500 mb-5">
              שלחנו קוד אימות ב-SMS{phoneForOtpDisplay ? ` למספר ${phoneForOtpDisplay}` : ""}
            </p>
            {errorBox}
            <form onSubmit={handleVerifySms} className="flex flex-col gap-3">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                label="קוד מ-SMS"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className="text-center tracking-[0.4em] text-lg"
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                אמת קוד SMS
              </Button>
              <button type="button" onClick={handleResendSms} className="text-sm text-primary hover:underline">
                שלח קוד מחדש
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (2/2)</h1>
            <p className="text-sm text-slate-500 mb-5">שלחנו קוד אימות נוסף לכתובת האימייל שלך</p>
            {errorBox}
            <form onSubmit={handleVerifyEmail} className="flex flex-col gap-3">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                label="קוד מהאימייל"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                className="text-center tracking-[0.4em] text-lg"
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                {mode === "new" ? "אמת קוד וסיים הרשמה" : "אמת קוד וכניסה"}
              </Button>
              <button type="button" onClick={handleResendEmail} className="text-sm text-primary hover:underline">
                שלח קוד מחדש
              </button>
            </form>
          </>
        )}
      </AuthLayout>
    );
  }

  // ---- New-patient step 2: personal details ----
  if (phase === "new-profile") {
    return (
      <AuthLayout>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-profile"]!} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[1]}</p>
        <button onClick={() => setPhase("new-credentials")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        {errorBox}
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
          <Input label="שם מלא" icon={<UserIcon className="h-4 w-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDocumentType("id")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                documentType === "id" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              תעודת זהות
            </button>
            <button
              type="button"
              onClick={() => setDocumentType("passport")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                documentType === "passport" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              דרכון
            </button>
          </div>
          <Input
            label={documentType === "id" ? "מספר תעודת זהות" : "מספר דרכון"}
            icon={<IdCard className="h-4 w-4" />}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            inputMode={documentType === "id" ? "numeric" : "text"}
            maxLength={documentType === "id" ? 9 : undefined}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              צילום {documentType === "id" ? "תעודת הזהות" : "הדרכון"}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>

          <Input
            label="תאריך לידה"
            type="date"
            icon={<Calendar className="h-4 w-4" />}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
          {isMinor && (
            <Input
              label="שם ההורה"
              icon={<UserIcon className="h-4 w-4" />}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
            />
          )}
          <Input label="טלפון נייד" icon={<Phone className="h-4 w-4" />} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input
            label="כתובת (אופציונלי)"
            placeholder="רחוב, מספר, עיר"
            value={insurance.address}
            onChange={(e) => setInsurance({ ...insurance, address: e.target.value })}
          />
          <Button type="submit" className="w-full mt-2">
            המשך לפרופיל ביטוחי
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // ---- New-patient step 3: insurance profile ----
  if (phase === "new-insurance") {
    return (
      <AuthLayout>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-insurance"]!} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[2]}</p>
        <button onClick={() => setPhase("new-profile")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        <form onSubmit={handleInsuranceSubmit} className="flex flex-col gap-3">
          <InsuranceProfileForm value={insurance} onChange={setInsurance} showAddress={false} />
          <Button type="submit" className="w-full mt-2">
            המשך להסכמות
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // ---- New-patient step 4: consent ----
  if (phase === "new-consent") {
    const canFinish = areRequiredConsentsChecked(consents);
    return (
      <AuthLayout>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-consent"]!} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[3]}</p>
        <button onClick={() => setPhase("new-insurance")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button className="w-full mt-4" disabled={!canFinish} onClick={handleStartFinalVerification}>
          המשך לאימות
        </Button>
      </AuthLayout>
    );
  }

  // ---- Default: mode toggle + step 1 (new) or the single existing-patient form ----
  return (
    <AuthLayout>
      {modeToggle}

      {mode === "new" && (
        <>
          <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-credentials"]!} />
          <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[0]}</p>
        </>
      )}

      <h1 className="text-lg font-semibold text-slate-900 mb-1">
        {mode === "new" ? "יצירת חשבון" : "התחברות"}
      </h1>
      <p className="text-sm text-slate-500 mb-5">
        {mode === "new" ? "הצטרפו לפלטפורמת HEALSON" : "היכנסו לחשבון שלכם כדי להמשיך"}
      </p>

      {errorBox}

      <Button variant="outline" size="sm" className="w-full mb-4" onClick={fillGoogleDemo}>
        המשך עם Google
      </Button>

      {mode === "new" ? (
        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
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
            המשך לפרטים אישיים
          </Button>
        </form>
      ) : (
        <form onSubmit={handleExistingSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="you@example.com"
            label="אימייל"
            icon={<Mail className="h-4 w-4" />}
            value={existingEmail}
            onChange={(e) => setExistingEmail(e.target.value)}
            required
          />
          <Input
            label="טלפון נייד"
            icon={<Phone className="h-4 w-4" />}
            value={existingPhone}
            onChange={(e) => setExistingPhone(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="••••••••"
            label="סיסמה"
            icon={<Lock className="h-4 w-4" />}
            value={existingPassword}
            onChange={(e) => setExistingPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="w-full mt-1">
            התחברות
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        נותן שירות?{" "}
        <Link href="/apply" className="text-primary font-medium hover:underline">
          הגישו בקשת הצטרפות כספק
        </Link>
      </p>
    </AuthLayout>
  );
}
