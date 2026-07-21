"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User as UserIcon, Phone, IdCard, Calendar, ArrowRight, Upload, FileText, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Stepper } from "@/components/shared/Stepper";
import { PasswordRequirements, passwordMeetsRequirements } from "@/components/shared/PasswordRequirements";
import { useStore } from "@/lib/store";
import { isValidIsraeliId, isValidEmail, isValidIsraeliPhone } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/file";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";
import { POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
import { Gender, GENDERS, UploadedFile } from "@/types";
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

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      className="text-slate-400 hover:text-slate-600"
      aria-label={show ? "הסתר סיסמה" : "הצג סיסמה"}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

/** Resend link with a countdown lock, plus an escalation option once the
 * user has resent enough times without success (see OTP_ISSUE_THRESHOLD). */
function ResendControl({
  secondsLeft,
  onResend,
  resendCount,
  issueReported,
  onReportIssue,
}: {
  secondsLeft: number;
  onResend: () => void;
  resendCount: number;
  issueReported: boolean;
  onReportIssue: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onResend}
        disabled={secondsLeft > 0}
        className={cn(
          "text-sm font-medium",
          secondsLeft > 0 ? "text-slate-400 cursor-not-allowed" : "text-primary hover:underline"
        )}
      >
        {secondsLeft > 0 ? `שליחה חוזרת בעוד 0:${String(secondsLeft).padStart(2, "0")}` : "שלח קוד מחדש"}
      </button>
      {resendCount >= OTP_ISSUE_THRESHOLD &&
        (issueReported ? (
          <p className="text-xs font-medium text-success-text">התקלה דווחה לצוות — ניצור קשר בהקדם</p>
        ) : (
          <button type="button" onClick={onReportIssue} className="text-xs font-medium text-danger-text hover:underline">
            עדיין לא קיבלתי את הקוד — דווחו לצוות
          </button>
        ))}
    </div>
  );
}

// Address is picked, not typed — a closed list keeps it demo-friendly (no
// free text to validate/normalize). This app makes no external/network
// calls (see utils.ts), so there's no real geo/address database behind it —
// a real deployment would connect to one (e.g. the Israeli postal/city
// registry) instead of this fixed list; a UI note below the fields says so.
// Streets are keyed by city, same pattern as K_LEVELS_BY_KUPAH, so picking a
// city narrows the street list instead of showing every street at once;
// cities without their own curated streets fall back to DEFAULT_STREETS.
const CITIES = [
  "תל אביב",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "בת ים",
  "אשקלון",
  "רחובות",
  "הרצליה",
  "כפר סבא",
  "מודיעין",
  "רעננה",
  "בית שמש",
  "נצרת",
  "לוד",
  "רמלה",
  "רמת השרון",
  "גבעתיים",
  "הוד השרון",
  "נהריה",
  "קריית אתא",
  "קריית גת",
  "קריית ביאליק",
  "קריית שמונה",
  "אילת",
  "טבריה",
  "עכו",
  "דימונה",
];
const STREETS_BY_CITY: Record<string, string[]> = {
  "תל אביב": ["הרצל 12", "אבן גבירול 50", "דיזנגוף 100"],
  "ירושלים": ["יפו 22", "בן יהודה 8", "עמק רפאים 15"],
  "חיפה": ["הרצל 8", "הנביאים 30", "מוריה 45"],
  "ראשון לציון": ["רוטשילד 20", "הרצל 5"],
  "פתח תקווה": ["חובבי ציון 10", "רוטשילד 60"],
  "רמת גן": ["ביאליק 12", "ז'בוטינסקי 40"],
  "הרצליה": ["סוקולוב 25", "בן גוריון 90"],
  "באר שבע": ["רגר 15", "הפלמח 33"],
};
const DEFAULT_STREETS = ["הרחוב הראשי 1", "שדרות העצמאות 10"];

const RESEND_COOLDOWN_SECONDS = 30;
// After this many resends without success, offer "לא קיבלתי" to flag a real
// delivery problem (wrong carrier, blocked sender, etc.) instead of letting
// the user resend forever.
const OTP_ISSUE_THRESHOLD = 2;

// The SMS + email OTP screens share one step here — they're already shown as
// sub-phases "(1/2)" / "(2/2)" of a single "אימות דו-שלבי" inside that screen,
// so folding them into one Stepper step frees up width per step on mobile.
const NEW_STEPS = ["פרטי התחברות", "פרטים אישיים", "פרופיל ביטוחי", "הסכמות", "אימות דו-שלבי"];
const NEW_PHASE_INDEX: Partial<Record<Phase, number>> = {
  "new-credentials": 0,
  "new-profile": 1,
  "new-insurance": 2,
  "new-consent": 3,
  "otp-sms": 4,
  "otp-email": 4,
};
const NEW_STEP_PHASES: Phase[] = [
  "new-credentials",
  "new-profile",
  "new-insurance",
  "new-consent",
  "otp-sms",
];

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

// Local to this page only — adds a "back to home" link without touching the
// shared AuthLayout used by /login, /register, /forgot-password, etc.
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Link
        href="/"
        className="fixed top-4 right-4 z-10 text-sm text-slate-500 hover:text-primary"
      >
        חזרה לדף הבית
      </Link>
      <AuthLayout>{children}</AuthLayout>
    </>
  );
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
  const reportOtpIssue = useStore((s) => s.reportOtpIssue);

  const [mode, setMode] = useState<Mode>("new");
  const [phase, setPhase] = useState<Phase>("new-credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  // Resend cooldown/reporting — only one OTP phase is ever visible at a
  // time, so a single "unlock at" timestamp covers whichever one is active;
  // resend counts are per-channel so switching from SMS to email starts a
  // fresh count instead of inheriting the SMS screen's.
  const [resendUnlockAt, setResendUnlockAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [smsResendCount, setSmsResendCount] = useState(0);
  const [emailResendCount, setEmailResendCount] = useState(0);
  const [smsIssueReported, setSmsIssueReported] = useState(false);
  const [emailIssueReported, setEmailIssueReported] = useState(false);

  // New-patient form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<"id" | "passport">("id");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoDialogOpen, setIdPhotoDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  // Collected as two short fields instead of one free-text "address" box —
  // structured enough to be useful, without the overhead of a full
  // street/number/apartment/zip form. Combined into insurance.address (the
  // single string Patient.address expects) when leaving this step.
  const [addressCity, setAddressCity] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [consents, setConsents] = useState<ConsentValues>({});

  // Existing-patient form fields
  const [existingEmail, setExistingEmail] = useState("");
  const [existingPhone, setExistingPhone] = useState("");
  const [existingPassword, setExistingPassword] = useState("");

  const phoneForOtpDisplay = mode === "new" ? phone : existingPhone;
  const dobAge = calcAge(dateOfBirth);
  const isMinor = dobAge !== null && dobAge < 18;

  // Live per-field validation for the credentials + personal-details steps —
  // computed on every keystroke (not just on submit) so the user sees what's
  // wrong with a value while still typing it, not after clicking "המשך".
  const emailError = email && !isValidEmail(email) ? "כתובת אימייל לא תקינה" : undefined;
  const idNumberTrimmed = idNumber.trim();
  const idNumberDuplicate = idNumberTrimmed !== "" && patients.some((p) => p.id_number === idNumberTrimmed);
  // The duplicate-ID message is deliberately generic, not "this ID is
  // already registered" — confirming that a specific ID number belongs to
  // an existing patient would let anyone probe whether a given person is
  // a patient here, which is more sensitive than typical email enumeration
  // since a national ID is tied to a real, unchangeable identity.
  const idNumberError = !idNumberTrimmed
    ? undefined
    : documentType === "id" && !isValidIsraeliId(idNumberTrimmed)
    ? "מספר תעודת זהות לא תקין"
    : documentType === "passport" && idNumberTrimmed.length < 4
    ? "מספר דרכון לא תקין"
    : idNumberDuplicate
    ? "לא ניתן להשלים את ההרשמה עם הפרטים שהוזנו. אם כבר יש לכם חשבון, נסו להתחבר"
    : undefined;
  const dobError = !dateOfBirth ? undefined : dobAge === null || dobAge > 120 ? "תאריך לידה לא תקין" : undefined;
  const phoneError = phone && !isValidIsraeliPhone(phone) ? "מספר טלפון לא תקין" : undefined;

  function switchMode(next: Mode) {
    setMode(next);
    setPhase(next === "new" ? "new-credentials" : "existing-form");
    setError("");
  }

  // Closes the popup as soon as a valid file lands, so the user drops
  // straight back into the personal-details form instead of needing an
  // extra "done" click.
  function handleIdPhotoChange(f: File | null) {
    setIdPhoto(f);
    if (f) setIdPhotoDialogOpen(false);
  }

  // Lets the user click an already-completed step on the Stepper to go back
  // and edit it; form fields keep their values since they live in this
  // component's state, so re-visiting a step shows what was already filled.
  function goToStep(index: number) {
    setError("");
    setPhase(NEW_STEP_PHASES[index]);
  }

  // This is a fully local demo with no backend persistence (see
  // CLAUDE.local.md), so a refresh mid-registration silently wipes
  // everything typed so far — warn before that happens once the user has
  // moved past the very first screen.
  useEffect(() => {
    if (mode !== "new" || phase === "new-credentials") return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mode, phase]);

  useEffect(() => {
    if (!resendUnlockAt) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((resendUnlockAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resendUnlockAt]);

  function fillGoogleDemo() {
    if (mode === "new") {
      setFullName(GOOGLE_DEMO_NEW.full_name);
      setPhone(GOOGLE_DEMO_NEW.phone);
      setEmail(GOOGLE_DEMO_NEW.email);
      setIdNumber(GOOGLE_DEMO_NEW.id_number);
      setDateOfBirth(GOOGLE_DEMO_NEW.date_of_birth);
      setPassword(GOOGLE_DEMO_NEW.password);
      setConfirmPassword(GOOGLE_DEMO_NEW.password);
      setAddressStreet("הרצל 12");
      setAddressCity("תל אביב");
    } else {
      setExistingEmail(GOOGLE_DEMO_EXISTING.email);
      setExistingPhone(GOOGLE_DEMO_EXISTING.phone);
      setExistingPassword(GOOGLE_DEMO_EXISTING.password);
    }
  }

  // If something (e.g. /book, blocked mid-flow behind the auth-required
  // popup) stashed a return path before sending the user here, resume there
  // once they finish — otherwise fall back to the normal post-auth home.
  function goAfterAuth(fallback: string) {
    const redirectTo = sessionStorage.getItem(POST_REGISTER_REDIRECT_KEY);
    sessionStorage.removeItem(POST_REGISTER_REDIRECT_KEY);
    router.push(redirectTo || fallback);
  }

  function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || emailError) {
      setError(emailError ?? "יש להזין כתובת אימייל");
      return;
    }
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
    if (!idNumberTrimmed || idNumberError) {
      setError(idNumberError ?? `יש להזין ${documentType === "id" ? "מספר תעודת זהות" : "מספר דרכון"}`);
      return;
    }
    if (!idPhoto) {
      setError(`יש להעלות צילום של ${documentType === "id" ? "תעודת הזהות" : "הדרכון"}`);
      return;
    }
    if (!dateOfBirth || dobError) {
      setError(dobError ?? "יש להזין תאריך לידה");
      return;
    }
    if (isMinor && !parentName.trim()) {
      setError("יש להזין את שם ההורה עבור מטופל קטין");
      return;
    }
    if (!phone || phoneError) {
      setError(phoneError ?? "יש להזין מספר טלפון");
      return;
    }
    setInsurance((prev) => ({
      ...prev,
      address: [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", "),
    }));
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
    setSmsResendCount(0);
    setSmsIssueReported(false);
    setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
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
        gender: gender || undefined,
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
    goAfterAuth("/client");
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
        setSmsResendCount(0);
        setSmsIssueReported(false);
        setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
        const hint = resendLoginOtp("sms");
        showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
        return;
      }
      const user = useStore.getState().currentUser;
      goAfterAuth(user ? homeForRole(user.role) : "/login");
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
      setEmailResendCount(0);
      setEmailIssueReported(false);
      setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
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
        goAfterAuth(user ? homeForRole(user.role) : "/login");
      }
    }, 300);
  }

  function handleResendSms() {
    if (secondsLeft > 0) return;
    const otp = mode === "new" ? resendRegistrationOtp("sms") : resendLoginOtp("sms");
    if (otp) {
      showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
      setSmsResendCount((c) => c + 1);
      setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    }
  }

  function handleResendEmail() {
    if (secondsLeft > 0) return;
    const otp = mode === "new" ? resendRegistrationOtp("email") : resendLoginOtp("email");
    if (otp) {
      showToast("קוד חדש נשלח באימייל", { description: `קוד הדגמה: ${otp}` });
      setEmailResendCount((c) => c + 1);
      setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    }
  }

  // Two resends without success is treated as a signal of a real delivery
  // problem — filed for the team to look into, not just another resend.
  function handleReportOtpIssue(channel: "sms" | "email") {
    const contact = channel === "sms" ? phoneForOtpDisplay : mode === "new" ? email : existingEmail;
    reportOtpIssue(channel, contact, mode === "new" ? "registration" : "login");
    if (channel === "sms") setSmsIssueReported(true);
    else setEmailIssueReported(true);
    showToast("התקלה דווחה לצוות", { description: "ניצור איתך קשר בהקדם לבירור העניין", variant: "success" });
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
      <PageShell>
        {mode === "new" && stepIdx !== undefined && (
          <>
            <Stepper steps={NEW_STEPS} step={stepIdx} onStepClick={goToStep} />
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
              <ResendControl
                secondsLeft={secondsLeft}
                onResend={handleResendSms}
                resendCount={smsResendCount}
                issueReported={smsIssueReported}
                onReportIssue={() => handleReportOtpIssue("sms")}
              />
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
              <ResendControl
                secondsLeft={secondsLeft}
                onResend={handleResendEmail}
                resendCount={emailResendCount}
                issueReported={emailIssueReported}
                onReportIssue={() => handleReportOtpIssue("email")}
              />
            </form>
          </>
        )}
      </PageShell>
    );
  }

  // ---- New-patient step 2: personal details ----
  if (phase === "new-profile") {
    return (
      <PageShell>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-profile"]!} onStepClick={goToStep} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[1]}</p>
        <button onClick={() => setPhase("new-credentials")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        {errorBox}
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
          <Input label="שם מלא" icon={<UserIcon className="h-4 w-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">מגדר</span>
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  gender === g
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {g}
              </button>
            ))}
          </div>

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
            error={idNumberError}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              צילום {documentType === "id" ? "תעודת הזהות" : "הדרכון"}
            </label>
            {idPhoto ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{idPhoto.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIdPhotoDialogOpen(true)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  החלפה
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIdPhotoDialogOpen(true)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-slate-600">
                  לחצו להעלאת צילום {documentType === "id" ? "תעודת הזהות" : "הדרכון"}
                </span>
                <span className="text-xs text-slate-400">PDF, JPG או PNG · עד 4MB</span>
              </button>
            )}
          </div>

          <Dialog
            open={idPhotoDialogOpen}
            onClose={() => setIdPhotoDialogOpen(false)}
            title={`העלאת צילום ${documentType === "id" ? "תעודת הזהות" : "הדרכון"}`}
            description="גררו קובץ לתיבה או לחצו לבחירה ממכשירכם"
          >
            <FileDropzone file={idPhoto} onFileChange={handleIdPhotoChange} />
          </Dialog>

          <Input
            label="תאריך לידה"
            type="date"
            icon={<Calendar className="h-4 w-4" />}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            error={dobError}
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
          <Input
            label="טלפון נייד"
            icon={<Phone className="h-4 w-4" />}
            placeholder="050-1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={phoneError}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="עיר (אופציונלי)"
              value={addressCity}
              onChange={(e) => {
                setAddressCity(e.target.value);
                setAddressStreet("");
              }}
            >
              <option value="">לא צוין</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              label="רחוב ומספר (אופציונלי)"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              disabled={!addressCity}
            >
              <option value="">{addressCity ? "בחרו רחוב" : "בחרו עיר קודם"}</option>
              {(STREETS_BY_CITY[addressCity] ?? DEFAULT_STREETS).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-slate-400 -mt-2">
            הרשימה לצורך הדגמה בלבד — באתר אמיתי שדה זה יתחבר למאגר כתובות חיצוני מלא
          </p>
          <Button type="submit" className="w-full mt-2">
            המשך לפרופיל ביטוחי
          </Button>
        </form>
      </PageShell>
    );
  }

  // ---- New-patient step 3: insurance profile ----
  if (phase === "new-insurance") {
    return (
      <PageShell>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-insurance"]!} onStepClick={goToStep} />
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
      </PageShell>
    );
  }

  // ---- New-patient step 4: consent ----
  if (phase === "new-consent") {
    const canFinish = areRequiredConsentsChecked(consents);
    return (
      <PageShell>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-consent"]!} onStepClick={goToStep} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[3]}</p>
        <button onClick={() => setPhase("new-insurance")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button className="w-full mt-4" disabled={!canFinish} onClick={handleStartFinalVerification}>
          המשך לאימות
        </Button>
      </PageShell>
    );
  }

  // ---- Default: mode toggle + step 1 (new) or the single existing-patient form ----
  return (
    <PageShell>
      {modeToggle}

      {mode === "new" && (
        <>
          <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-credentials"]!} onStepClick={goToStep} />
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

      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">או</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {mode === "new" ? (
        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="you@example.com"
            label="אימייל"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            required
          />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            label="סיסמה"
            icon={<Lock className="h-4 w-4" />}
            endAdornment={<PasswordToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordRequirements password={password} />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            label="אימות סיסמה"
            icon={<Lock className="h-4 w-4" />}
            endAdornment={
              <PasswordToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
            }
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && confirmPassword !== password ? "הסיסמאות אינן תואמות" : undefined}
            hint={
              confirmPassword && confirmPassword === password ? (
                <span className="text-success-text">הסיסמאות תואמות ✓</span>
              ) : undefined
            }
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
            type={showExistingPassword ? "text" : "password"}
            placeholder="••••••••"
            label="סיסמה"
            icon={<Lock className="h-4 w-4" />}
            endAdornment={
              <PasswordToggle show={showExistingPassword} onToggle={() => setShowExistingPassword((v) => !v)} />
            }
            value={existingPassword}
            onChange={(e) => setExistingPassword(e.target.value)}
            required
          />
          <div className="flex justify-end -mt-1.5">
            <Link href="/forgot-password?from=client" className="text-xs text-primary hover:underline">
              שכחת סיסמה?
            </Link>
          </div>
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
    </PageShell>
  );
}
