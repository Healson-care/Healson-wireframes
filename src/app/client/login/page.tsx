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
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { isValidIsraeliId, isValidEmail, isValidIsraeliPhone } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/file";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";
import { POST_REGISTER_REDIRECT_KEY, CITIES, STREETS_BY_CITY, DEFAULT_STREETS } from "@/lib/constants";
import { Gender, GENDERS, UploadedFile } from "@/types";
import { useOtpAttemptGuard, ResendControl, BlockedPanel, WrongAttemptsLockoutNotice } from "@/components/shared/OtpAttemptGuard";
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
  | "otp-email"
  // Existing-patient login only — true 2FA, one OTP screen (see otp-sms /
  // otp-email above, which are registration's two-step identity proofing).
  | "otp-login";

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

// ResendControl/BlockedPanel/the attempt-guard mechanics live in
// @/components/shared/OtpAttemptGuard now — shared by every OTP screen in
// the app, not just this page's.

// Verification sits right after credentials — email+phone are both
// collected in that first step now, so identity is confirmed before asking
// for anything else at all (name, ID, insurance...). The SMS + email
// screens still share one Stepper step, shown as sub-phases "(1/2)" /
// "(2/2)" of a single "אימות דו-שלבי" inside that screen.
const NEW_STEPS = ["פרטי התחברות", "אימות דו-שלבי", "פרטים אישיים", "פרופיל ביטוחי", "הסכמות"];
const NEW_PHASE_INDEX: Partial<Record<Phase, number>> = {
  "new-credentials": 0,
  "otp-sms": 1,
  "otp-email": 1,
  "new-profile": 2,
  "new-insurance": 3,
  "new-consent": 4,
};
// Index 1 ("otp-sms") is a one-time gate, not editable form data — goToStep
// special-cases it to restart verification fresh rather than just jumping
// to a phase whose pending state may already be consumed.
const NEW_STEP_PHASES: Phase[] = ["new-credentials", "otp-sms", "new-profile", "new-insurance"];

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

// Thin wrapper requiring every screen in this flow to supply onClose (see
// handleClose below) — AuthLayout itself falls back to a plain, no-cleanup
// "/" link when onClose is omitted, which is exactly the bug this fixes.
function PageShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <AuthLayout onClose={onClose}>{children}</AuthLayout>;
}

export default function ClientLoginPage() {
  const router = useRouter();
  const showToast = useStore((s) => s.showToast);
  const patients = useStore((s) => s.patients);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const currentPatient = useCurrentPatient();

  // New-patient registration
  const register = useStore((s) => s.register);
  const verifyOtp = useStore((s) => s.verifyOtp);
  const completePatientRegistration = useStore((s) => s.completePatientRegistration);
  const beginRegistrationVerification = useStore((s) => s.beginRegistrationVerification);
  const resetRegistrationVerification = useStore((s) => s.resetRegistrationVerification);
  const pendingRegistrationVerification = useStore((s) => s.pendingRegistrationVerification);
  const verifyRegistrationSmsOtp = useStore((s) => s.verifyRegistrationSmsOtp);
  const verifyRegistrationEmailLink = useStore((s) => s.verifyRegistrationEmailLink);
  const resendRegistrationOtp = useStore((s) => s.resendRegistrationOtp);

  // Existing-patient login
  const login = useStore((s) => s.login);
  const verifyLoginOtp = useStore((s) => s.verifyLoginOtp);
  const resendLoginOtp = useStore((s) => s.resendLoginOtp);
  const pendingLoginVerification = useStore((s) => s.pendingLoginVerification);

  const [mode, setMode] = useState<Mode>("existing");
  const [phase, setPhase] = useState<Phase>("existing-form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration's SMS step and existing-patient login's single OTP step
  // share one guard instance — registration and login are never both
  // active at once, so reusing it is safe and keeps their resend/lockout
  // counts unified the way the old local state did. Registration's email
  // step gets its own, independent instance.
  const smsGuard = useOtpAttemptGuard(mode === "new" ? "registration" : "login");
  const emailGuard = useOtpAttemptGuard("registration");
  // Also doubles as the login-OTP field's value (see handleVerifyLoginOtp) —
  // registration and login are never both active, so one field is enough.
  const [smsCode, setSmsCode] = useState("");

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
  const [secondaryPhone, setSecondaryPhone] = useState("");
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
  const [existingPassword, setExistingPassword] = useState("");

  // Existing patients don't get asked for their phone at all — it's already
  // on file from when they registered (see pendingLoginVerification below),
  // unlike registration where it's genuinely new information.
  const loginPatientUserId = pendingLoginVerification?.userId;
  const loginPatientPhone = loginPatientUserId
    ? patients.find((p) => p.user_id === loginPatientUserId)?.phone
    : undefined;
  const phoneForOtpDisplay = mode === "new" ? phone : loginPatientPhone;
  const dobAge = calcAge(dateOfBirth);

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
  // Optional field, so an empty value is fine — but a typed one still has to
  // be a real number, and can't just repeat the one already verified.
  const secondaryPhoneError = !secondaryPhone
    ? undefined
    : !isValidIsraeliPhone(secondaryPhone)
    ? "מספר טלפון לא תקין"
    : secondaryPhone === phone
    ? "מספר הטלפון הנוסף זהה למספר הראשי"
    : undefined;

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
    const target = NEW_STEP_PHASES[index];
    if (target === "otp-sms") {
      // The previous verification session is already consumed (or never
      // started) by the time later steps are reachable — restart it fresh
      // rather than showing a code screen that can never succeed.
      handleStartFinalVerification();
      return;
    }
    setPhase(target);
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

  function fillGoogleDemo() {
    if (mode === "new") {
      setFullName(GOOGLE_DEMO_NEW.full_name);
      // Phone deliberately isn't prefilled — Google sign-in doesn't actually
      // hand over a verified phone number either, so this path should also
      // go through the phone prompt on the SMS screen, same as email/password.
      setEmail(GOOGLE_DEMO_NEW.email);
      setIdNumber(GOOGLE_DEMO_NEW.id_number);
      setDateOfBirth(GOOGLE_DEMO_NEW.date_of_birth);
      setPassword(GOOGLE_DEMO_NEW.password);
      setConfirmPassword(GOOGLE_DEMO_NEW.password);
      setAddressStreet("הרצל 12");
      setAddressCity("תל אביב");
    } else {
      setExistingEmail(GOOGLE_DEMO_EXISTING.email);
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

  // register()+verifyOtp() (step 1 of the "new" flow, see
  // handleCredentialsSubmit) already create a real logged-in session, purely
  // so completePatientRegistration has a userId to attach the Patient
  // record to at the very end. If the user bails out via "חזרה לדף הבית"
  // before that final step, currentUser stays set with no Patient behind
  // it — useRequireRole("patient") would then happily let them into
  // /client with a broken, patient-less session. Clear it here so leaving
  // mid-registration really starts fresh, same as /register's handleClose.
  function handleClose() {
    if (currentUser && !currentPatient) logout();
    router.push("/");
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
      // Email is verified right away (no separate email-only OTP screen —
      // the mail step later shares this same verification). Phone isn't
      // collected yet at this point on purpose (see phase "otp-sms" below),
      // so the SMS code can't be sent until the next screen asks for it —
      // unless it's already known (e.g. re-submitting this step after having
      // already gone through the phone prompt once), in which case skip
      // straight to re-sending it.
      verifyOtp(email, result.otpHint);
      if (phone && !phoneError) {
        handleStartFinalVerification();
      } else {
        // A stale pendingRegistrationVerification from a registration
        // abandoned in a previous session (this store persists to
        // localStorage) would otherwise make the SMS screen think it
        // already sent a code and skip straight past the phone prompt.
        resetRegistrationVerification();
        setPhase("otp-sms");
      }
    }, 300);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gender) {
      setError("יש לבחור מגדר");
      return;
    }
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
    if (!parentName.trim()) {
      setError("יש להזין את שם האב");
      return;
    }
    if (secondaryPhoneError) {
      setError(secondaryPhoneError);
      return;
    }
    if (!addressCity || !addressStreet) {
      setError("יש לבחור עיר ורחוב");
      return;
    }
    setInsurance((prev) => ({
      ...prev,
      address: [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", "),
    }));
    // Identity (email+phone) is already verified at this point — see
    // handleCredentialsSubmit — so just move on to insurance.
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
    smsGuard.start();
    const hint = resendRegistrationOtp("sms");
    showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
  }

  // Phone is asked for here, on the SMS screen itself, rather than back on
  // the credentials step — nothing needs it before this exact moment.
  function handleSubmitPhoneForSms(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone || phoneError) {
      setError(phoneError ?? "יש להזין מספר טלפון");
      return;
    }
    handleStartFinalVerification();
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
        secondary_phone: secondaryPhone.trim() || undefined,
        id_number: idNumber.trim(),
        id_document_type: documentType,
        id_document_photo: photo,
        date_of_birth: dateOfBirth,
        gender: gender || undefined,
        parent_name: parentName.trim() || undefined,
        kupah: insurance.kupah || undefined,
        k_level: insurance.k_level || undefined,
        b_insurances: insurance.b_insurances.length > 0 ? insurance.b_insurances : undefined,
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
        setPhase("otp-login");
        smsGuard.start();
        const hint = resendLoginOtp();
        showToast("קוד אימות נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
        return;
      }
      const user = useStore.getState().currentUser;
      goAfterAuth(user ? homeForRole(user.role) : "/login");
    }, 300);
  }

  // Registration only — the first of its two identity-proofing steps.
  function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (smsGuard.verifyLockSecondsLeft > 0) return;
    setLoading(true);
    setTimeout(() => {
      const result = verifyRegistrationSmsOtp(smsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        smsGuard.noteWrongAttempt();
        return;
      }
      setPhase("otp-email");
      emailGuard.start();
      // No code to show a "demo hint" for — the confirmation card on the
      // next screen *is* the simulated email, so there's nothing to send
      // separately here.
      resendRegistrationOtp("email");
      showToast("שלחנו לך מייל עם קישור לאישור החשבון", { variant: "success" });
    }, 300);
  }

  // Registration only — clicking the (simulated) link in the confirmation
  // card below is the entire "verification," no code to check. Identity is
  // now confirmed, but registration isn't finished yet — insurance/consent
  // still come after this, so move on to those instead of finishing here.
  function handleConfirmEmailLink() {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyRegistrationEmailLink();
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setPhase("new-profile");
    }, 300);
  }

  // Existing-patient login only — true 2FA, single OTP (see the store-level
  // comment on PendingLoginVerification). Reuses smsGuard since registration
  // and login are never active at the same time.
  function handleVerifyLoginOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (smsGuard.verifyLockSecondsLeft > 0) return;
    setLoading(true);
    setTimeout(() => {
      const result = verifyLoginOtp(smsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        smsGuard.noteWrongAttempt();
        return;
      }
      const user = useStore.getState().currentUser;
      goAfterAuth(user ? homeForRole(user.role) : "/login");
    }, 300);
  }

  // Registration only.
  function handleResendSms() {
    if (smsGuard.secondsLeft > 0 || smsGuard.blocked) return;
    const otp = resendRegistrationOtp("sms");
    if (otp) {
      showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
      smsGuard.noteResend();
    }
  }

  // Registration only.
  function handleResendEmail() {
    if (emailGuard.secondsLeft > 0 || emailGuard.blocked) return;
    if (!resendRegistrationOtp("email")) return;
    showToast("שלחנו שוב מייל עם קישור לאישור החשבון");
    emailGuard.noteResend();
  }

  // Existing-patient login only.
  function handleResendLoginOtp() {
    if (smsGuard.secondsLeft > 0 || smsGuard.blocked) return;
    const otp = resendLoginOtp();
    if (otp) {
      showToast("קוד חדש נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${otp}` });
      smsGuard.noteResend();
    }
  }

  // Two resends without success is treated as a signal of a real delivery
  // problem — filed for the team to look into, not just another resend.
  function handleReportOtpIssue(channel: "sms" | "email") {
    const contact = (channel === "sms" ? phoneForOtpDisplay : mode === "new" ? email : existingEmail) ?? "";
    (channel === "sms" ? smsGuard : emailGuard).reportIssue(channel, contact);
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
  // Registration only from here down — existing-patient login uses the
  // separate, single-step "otp-login" phase below instead.
  if (phase === "otp-sms" || phase === "otp-email") {
    const stepIdx = NEW_PHASE_INDEX[phase];
    return (
      <PageShell onClose={handleClose}>
        {stepIdx !== undefined && (
          <>
            <Stepper steps={NEW_STEPS} step={stepIdx} onStepClick={goToStep} />
            <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[stepIdx]}</p>
          </>
        )}
        {phase === "otp-sms" ? (
          !pendingRegistrationVerification ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (1/2)</h1>
              <p className="text-sm text-slate-500 mb-5">נשלח קוד אימות ב-SMS למספר הטלפון שלכם</p>
              {errorBox}
              <form onSubmit={handleSubmitPhoneForSms} className="flex flex-col gap-3">
                <Input
                  label="טלפון נייד"
                  icon={<Phone className="h-4 w-4" />}
                  placeholder="050-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={phoneError}
                  required
                  autoFocus
                />
                <Button type="submit" loading={loading} className="w-full">
                  שלח קוד אימות
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (1/2)</h1>
              <p className="text-sm text-slate-500 mb-5">
                שלחנו קוד אימות ב-SMS{phoneForOtpDisplay ? ` למספר ${phoneForOtpDisplay}` : ""}
              </p>
              {errorBox}
              {smsGuard.blocked ? (
                <BlockedPanel />
              ) : (
                <form onSubmit={handleVerifySms} className="flex flex-col gap-3">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    label="קוד מ-SMS"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className="text-center tracking-[0.4em] text-lg"
                    disabled={smsGuard.verifyLockSecondsLeft > 0}
                    required
                  />
                  <WrongAttemptsLockoutNotice secondsLeft={smsGuard.verifyLockSecondsLeft} />
                  <Button type="submit" loading={loading} disabled={smsGuard.verifyLockSecondsLeft > 0} className="w-full">
                    אמת קוד SMS
                  </Button>
                  <ResendControl
                    secondsLeft={smsGuard.secondsLeft}
                    onResend={handleResendSms}
                    resendCount={smsGuard.resendCount}
                    issueReported={smsGuard.issueReported}
                    onReportIssue={() => handleReportOtpIssue("sms")}
                  />
                </form>
              )}
            </>
          )
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (2/2)</h1>
            <p className="text-sm text-slate-500 mb-5">שלחנו לך מייל עם קישור לאישור החשבון</p>
            {errorBox}
            {emailGuard.blocked ? (
              <BlockedPanel />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-500">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-medium">מייל הדגמה מ-HEALSON</span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">לחצו על הקישור הבא כדי לאשר את פרטי ההרשמה שלכם.</p>
                  <Button type="button" onClick={handleConfirmEmailLink} loading={loading} className="w-full">
                    אשרו את החשבון שלי
                  </Button>
                </div>
                <ResendControl
                  secondsLeft={emailGuard.secondsLeft}
                  onResend={handleResendEmail}
                  resendCount={emailGuard.resendCount}
                  issueReported={emailGuard.issueReported}
                  onReportIssue={() => handleReportOtpIssue("email")}
                />
              </div>
            )}
          </>
        )}
      </PageShell>
    );
  }

  // Existing-patient login only — true 2FA, single OTP screen (see
  // PendingLoginVerification in store.ts).
  if (phase === "otp-login") {
    return (
      <PageShell onClose={handleClose}>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-גורמי</h1>
        <p className="text-sm text-slate-500 mb-5">
          שלחנו קוד אימות גם ב-SMS{phoneForOtpDisplay ? ` למספר ${phoneForOtpDisplay}` : ""} וגם למייל שלך — הקוד
          זהה בשני הערוצים, מספיק להזין אותו פעם אחת.
        </p>
        {errorBox}
        {smsGuard.blocked ? (
          <BlockedPanel />
        ) : (
          <form onSubmit={handleVerifyLoginOtp} className="flex flex-col gap-3">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              label="קוד אימות"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              className="text-center tracking-[0.4em] text-lg"
              disabled={smsGuard.verifyLockSecondsLeft > 0}
              required
            />
            <WrongAttemptsLockoutNotice secondsLeft={smsGuard.verifyLockSecondsLeft} />
            <Button type="submit" loading={loading} disabled={smsGuard.verifyLockSecondsLeft > 0} className="w-full">
              אמת קוד וכניסה
            </Button>
            <ResendControl
              secondsLeft={smsGuard.secondsLeft}
              onResend={handleResendLoginOtp}
              resendCount={smsGuard.resendCount}
              issueReported={smsGuard.issueReported}
              onReportIssue={() => handleReportOtpIssue("sms")}
            />
          </form>
        )}
      </PageShell>
    );
  }

  // ---- New-patient step 2: personal details ----
  if (phase === "new-profile") {
    return (
      <PageShell onClose={handleClose}>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-profile"]!} onStepClick={goToStep} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[2]}</p>
        <button onClick={() => setPhase("new-credentials")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        {errorBox}
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
          <Input label="שם מלא" icon={<UserIcon className="h-4 w-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              מגדר
              <span aria-hidden className="text-danger">{" *"}</span>
            </span>
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={documentType === "passport"}
              onChange={(e) => {
                // Un-checking after having already picked "אין לי קופת
                // חולים" on the insurance step leaves kupah on "" — for an
                // ת"ז holder that now renders as the "בחרו קופת חולים"
                // placeholder, whose `required` forces re-picking a real
                // kupah there; no reset needed here.
                setDocumentType(e.target.checked ? "passport" : "id");
              }}
              className="h-4 w-4 rounded border-slate-300 accent-primary"
            />
            <span className="text-sm text-slate-600">אין לי אזרחות ישראלית</span>
          </label>
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
          <Input
            label="שם האב"
            icon={<UserIcon className="h-4 w-4" />}
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
          />
          {/* The primary phone is already verified by this step (see the
              otp-sms phase), so this one is purely a fallback contact — it
              never receives an OTP and therefore isn't verified either. */}
          <Input
            label="מספר טלפון נוסף (אופציונלי)"
            type="tel"
            icon={<Phone className="h-4 w-4" />}
            placeholder="למשל בן/בת זוג, הורה או טלפון בעבודה"
            value={secondaryPhone}
            onChange={(e) => setSecondaryPhone(e.target.value)}
            error={secondaryPhoneError}
            hint={phone ? `המספר הראשי שאומת: ${phone}` : undefined}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="עיר"
              required
              value={addressCity}
              onChange={(e) => {
                setAddressCity(e.target.value);
                setAddressStreet("");
              }}
            >
              <option value="">בחרו עיר</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              label="רחוב ומספר"
              required
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
      <PageShell onClose={handleClose}>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-insurance"]!} onStepClick={goToStep} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[3]}</p>
        <button onClick={() => setPhase("new-profile")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">פרופיל ביטוחי</h1>
        <p className="text-sm text-slate-500 mb-5">
          הכיסוי הביטוחי שלכם קובע אילו מחירים והחזרים תראו בהזמנת שירותים — רק בחירת הקופה היא חובה
        </p>
        <form onSubmit={handleInsuranceSubmit} className="flex flex-col gap-3">
          <InsuranceProfileForm
            value={insurance}
            onChange={setInsurance}
            showAddress={false}
            allowNoKupah={documentType === "passport"}
          />
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
      <PageShell onClose={handleClose}>
        <Stepper steps={NEW_STEPS} step={NEW_PHASE_INDEX["new-consent"]!} onStepClick={goToStep} />
        <p className="text-xs text-slate-400 mb-4">{NEW_STEPS[4]}</p>
        <button onClick={() => setPhase("new-insurance")} className="text-sm text-primary mb-3 flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" /> חזרה
        </button>
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button className="w-full mt-4" disabled={!canFinish} onClick={() => void finishNewRegistration()}>
          סיום ההרשמה
        </Button>
      </PageShell>
    );
  }

  // ---- Default: mode toggle + step 1 (new) or the single existing-patient form ----
  return (
    <PageShell onClose={handleClose}>
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

      {mode === "existing" && (
        <p className="mt-5 text-center text-sm text-slate-500">
          אין לך משתמש?{" "}
          <button type="button" onClick={() => switchMode("new")} className="text-primary font-medium hover:underline">
            הרשם
          </button>
        </p>
      )}

      <p className="mt-2 text-center text-sm text-slate-500">
        נותן שירות?{" "}
        <Link href="/apply" className="text-primary font-medium hover:underline">
          הגישו בקשת הצטרפות כספק
        </Link>
      </p>
    </PageShell>
  );
}
