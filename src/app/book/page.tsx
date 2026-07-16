"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, IdCard, Mail, Phone, User as UserIcon, ArrowRight, ArrowLeft, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveProviderPrice } from "@/lib/pricing";
import { isValidIsraeliId } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/shared/Logo";
import { BookingStepper } from "@/components/book/BookingStepper";
import { ProviderDiscovery } from "@/components/book/ProviderDiscovery";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl } from "@/lib/utils";
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
import { ProviderProfile } from "@/types";

const HOLD_SECONDS = 180;

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};
const stepTransition = { duration: 0.25, ease: "easeOut" as const };

export default function BookPage() {
  const router = useRouter();
  const providers = useStore((s) => s.providers);
  const appointments = useStore((s) => s.appointments);
  const patients = useStore((s) => s.patients);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const quickRegisterPatient = useStore((s) => s.quickRegisterPatient);
  const beginRegistrationVerification = useStore((s) => s.beginRegistrationVerification);
  const verifyRegistrationSmsOtp = useStore((s) => s.verifyRegistrationSmsOtp);
  const verifyRegistrationEmailOtp = useStore((s) => s.verifyRegistrationEmailOtp);
  const resendRegistrationOtp = useStore((s) => s.resendRegistrationOtp);
  const addAppointment = useStore((s) => s.addAppointment);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addOrder = useStore((s) => s.addOrder);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  const [step, setStep] = useState(0);

  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);

  // Step 1: lead capture
  const [leadForm, setLeadForm] = useState({ full_name: "", phone: "", email: "", id_number: "", date_of_birth: "" });
  const [leadError, setLeadError] = useState("");

  // Step 2: consent (§4.2, §11.1)
  const [consents, setConsents] = useState<ConsentValues>({});

  // Step 3: insurance profile (§4.3, §7.1), then a double SMS+email OTP
  // gate before the lead actually becomes a registered patient.
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [insurancePhase, setInsurancePhase] = useState<"form" | "otp-sms" | "otp-email">("form");
  const [bookingSmsCode, setBookingSmsCode] = useState("");
  const [bookingEmailCode, setBookingEmailCode] = useState("");
  const [otpError, setOtpError] = useState("");

  // Step 4: slot selection + hold
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; label: string } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<{ date?: string; time?: string; label?: string } | null>(null);

  // Step 5: payment
  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);

  // Step 6: result
  const [confirmation, setConfirmation] = useState<{
    fileNumber: string;
    price: number;
    icsUrl: string;
  } | null>(null);
  const [pendingQuestionnaire, setPendingQuestionnaire] = useState<{ appointmentId: string; title: string } | null>(
    null
  );

  const consultation = selectedProvider?.consultation_types[0];
  const resolvedPrice =
    consultation && selectedProvider ? resolveProviderPrice(consultation.prices, selectedProvider.agreements, patient) : null;
  const price = resolvedPrice?.price ?? consultation?.prices.find((p) => p.layer === "H")?.price ?? 0;

  // Only ever invoked from the slot button's onClick — safe to read the clock here.
  // Creating the appointment here (not at payment time) is deliberate: from the
  // moment a slot is picked it's "ממתין לתשלום מקדמה" in the patient's history,
  // even if they never complete payment.
  function selectSlot(date: string, time: string, label: string) {
    if (!selectedProvider) return;
    if (patient?.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    const appointment = addAppointment({
      client_name: leadForm.full_name,
      client_phone: leadForm.phone,
      provider_id: selectedProvider.id,
      provider_name: `${selectedProvider.title ?? ""} ${selectedProvider.display_name}`.trim(),
      service_name: consultation?.name ?? "ייעוץ",
      date,
      time,
      duration_minutes: consultation?.duration_minutes ?? 30,
      status: "ממתין לתשלום מקדמה",
      price,
      deposit_amount: Math.round(price * 0.3),
      kupah: insurance.kupah,
      notes: "",
      created_by_id: patient?.id ?? currentUser?.id,
    });
    setPendingAppointmentId(appointment.id);
    setSelectedSlot({ date, time, label });
    // eslint-disable-next-line react-hooks/purity -- event handler, not render logic
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(5);
  }

  // Leaving the payment step without paying — whether the hold timer ran out
  // or the patient backed out manually — cancels that pending attempt instead
  // of leaving it stuck "ממתין לתשלום מקדמה" forever.
  function abandonHold() {
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
  }

  const handleHoldExpire = useCallback(() => {
    showToast("ה-Hold פג", { description: "התור שוחרר. רוצה לנסות שוב?", variant: "destructive" });
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setStep(4);
  }, [pendingAppointmentId, showToast, updateAppointment]);

  function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadError("");
    if (!isValidIsraeliId(leadForm.id_number)) {
      setLeadError("מספר תעודת זהות לא תקין");
      return;
    }
    if (patients.some((p) => p.id_number === leadForm.id_number.trim())) {
      setLeadError("תעודת זהות זו כבר רשומה במערכת");
      return;
    }
    setStep(2);
  }

  function handleConsentContinue() {
    setStep(3);
  }

  function handleInsuranceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    beginRegistrationVerification();
    setInsurancePhase("otp-sms");
    const hint = resendRegistrationOtp("sms");
    showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
  }

  function completeQuickRegistration() {
    quickRegisterPatient(
      {
        ...leadForm,
        kupah: insurance.kupah,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
        address: insurance.address || undefined,
      },
      consents
    );
    setStep(4);
  }

  function handleVerifyBookingSms(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    const result = verifyRegistrationSmsOtp(bookingSmsCode);
    if (!result.ok) {
      setOtpError(result.error ?? "שגיאה באימות");
      return;
    }
    setInsurancePhase("otp-email");
    const hint = resendRegistrationOtp("email");
    showToast("קוד אימות נשלח באימייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
  }

  function handleVerifyBookingEmail(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    const result = verifyRegistrationEmailOtp(bookingEmailCode);
    if (!result.ok) {
      setOtpError(result.error ?? "שגיאה באימות");
      return;
    }
    completeQuickRegistration();
  }

  function handleResendBookingSms() {
    const otp = resendRegistrationOtp("sms");
    if (otp) showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
  }

  function handleResendBookingEmail() {
    const otp = resendRegistrationOtp("email");
    if (otp) showToast("קוד חדש נשלח באימייל", { description: `קוד הדגמה: ${otp}` });
  }

  function handlePay() {
    if (!selectedProvider || !selectedSlot || !pendingAppointmentId) return;
    if (patient?.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    setPaying(true);
    setTimeout(() => {
      const commissionRate = selectedProvider.commission_rate ?? 15;
      const commissionAmount = Math.round((price * commissionRate) / 100);
      // Payment success is the moment the pending hold becomes a confirmed
      // appointment — and the moment this lead becomes a client in practice.
      updateAppointment(pendingAppointmentId, { status: "מאושר", deposit_paid_at: new Date().toISOString() });
      addOrder({
        item_name: consultation?.name ?? "ייעוץ",
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.display_name,
        created_by_id: patient?.id ?? currentUser?.id,
        patient_name: leadForm.full_name,
        final_price: price,
        status: "מאושר",
        payment_status: "מקדמה שולמה",
        deposit_amount: Math.round(price * 0.3),
        balance_amount: Math.round(price * 0.7),
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        provider_payout_amount: price - commissionAmount,
      });
      // The receipt and (if the service requires one) the pre-visit
      // questionnaire are created the moment the deposit clears, linked to
      // this appointment — same as the confirmation email/SMS a real clinic
      // would send at this point.
      const patientId = patient?.id ?? currentUser?.id;
      if (patientId) {
        addDocument({
          patient_id: patientId,
          category: "receipt",
          title: `קבלה על מקדמה - ${consultation?.name ?? "ייעוץ"}`,
          uploaded_by: "system",
          appointment_id: pendingAppointmentId,
          file: {
            file_name: "קבלה.pdf",
            uploaded_at: new Date().toISOString(),
            data_url: "data:application/pdf;base64,",
          },
        });
        if (consultation?.requires_questionnaire) {
          const questionnaireTitle = consultation.questionnaire_title ?? "שאלון לפני התור";
          addDocument({
            patient_id: patientId,
            category: "questionnaire",
            title: questionnaireTitle,
            uploaded_by: "system",
            appointment_id: pendingAppointmentId,
            status: "ממתין למילוי",
          });
          setPendingQuestionnaire({ appointmentId: pendingAppointmentId, title: questionnaireTitle });
        }
      }
      const icsUrl = buildIcsDataUrl({
        title: `תור ל-${selectedProvider.display_name}`,
        description: consultation?.name,
        location: selectedProvider.clinic_locations[0]?.address,
        date: selectedSlot.date,
        time: selectedSlot.time,
        durationMinutes: consultation?.duration_minutes ?? 30,
      });
      const fileNumber = Math.random().toString(36).slice(2, 8).toUpperCase();
      setConfirmation({ fileNumber, price, icsUrl });
      setPaying(false);
      setStep(6);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <Link href="/">
            <Logo size={30} className="text-lg" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-primary">
              חזרה לדף הבית
            </Link>
            {/* A lead here (in-progress "מטופל חדש" registration, no Patient
                record yet) has no way back to /login otherwise — the header's
                own "אזור אישי" button just sends them right back here. */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" /> התנתק
              </button>
            ) : (
              <Link href="/login" className="text-sm text-slate-500 hover:text-primary">
                כניסה
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <BookingStepper step={step} />

        <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <ProviderDiscovery
              providers={providers}
              patient={patient}
              onSelect={(p) => {
                setSelectedProvider(p);
                setStep(1);
              }}
            />
          </motion.div>
        )}

        {step === 1 && selectedProvider && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button onClick={() => setStep(0)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> בחירת רופא אחר
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">כמה פרטים ונמשיך</h2>
              <p className="text-slate-500 text-sm mt-1">בלי סיסמה, בלי טפסים מסובכים</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex gap-2 mb-5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setLeadForm({
                      full_name: "נועה כהן",
                      phone: "050-1234567",
                      email: "noa@example.co.il",
                      id_number: "123456782",
                      date_of_birth: "1990-01-01",
                    })
                  }
                >
                  המשך עם Google
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setLeadForm({
                      full_name: "נועה כהן",
                      phone: "050-1234567",
                      email: "noa@example.co.il",
                      id_number: "123456782",
                      date_of_birth: "1990-01-01",
                    })
                  }
                >
                  המשך עם Apple
                </Button>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-xs text-slate-400">או הזינו פרטים</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              {leadError && (
                <div className="mb-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
                  {leadError}
                </div>
              )}
              <form onSubmit={handleLeadSubmit} className="flex flex-col gap-3">
                <Input
                  placeholder="שם מלא"
                  icon={<UserIcon className="h-4 w-4" />}
                  value={leadForm.full_name}
                  onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })}
                  required
                />
                <Input
                  placeholder="תעודת זהות"
                  icon={<IdCard className="h-4 w-4" />}
                  value={leadForm.id_number}
                  onChange={(e) => setLeadForm({ ...leadForm, id_number: e.target.value })}
                  inputMode="numeric"
                  maxLength={9}
                  required
                />
                <Input
                  type="date"
                  placeholder="תאריך לידה"
                  icon={<Calendar className="h-4 w-4" />}
                  value={leadForm.date_of_birth}
                  onChange={(e) => setLeadForm({ ...leadForm, date_of_birth: e.target.value })}
                  required
                />
                <Input
                  placeholder="טלפון נייד"
                  icon={<Phone className="h-4 w-4" />}
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="אימייל"
                  icon={<Mail className="h-4 w-4" />}
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  required
                />
                <Button type="submit" size="lg" className="mt-2">
                  המשך להסכמות <ArrowLeft className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}

        {step === 2 && selectedProvider && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button onClick={() => setStep(1)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> חזרה
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">הסכמות</h2>
              <p className="text-slate-500 text-sm mt-1">אנא סמנו את ההסכמות הנדרשות לפני שמירת נתוני הבריאות שלכם</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <ConsentCheckboxes value={consents} onChange={setConsents} />
              <Button
                size="lg"
                className="w-full mt-5"
                disabled={!areRequiredConsentsChecked(consents)}
                onClick={handleConsentContinue}
              >
                המשך לפרופיל ביטוחי <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && selectedProvider && insurancePhase === "form" && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button onClick={() => setStep(2)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> חזרה
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">פרופיל ביטוחי</h2>
              <p className="text-slate-500 text-sm mt-1">המחיר שיוצג לכם מותאם לשכבת הביטוח שלכם מול הרופא שנבחר</p>
            </div>
            <form onSubmit={handleInsuranceSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <InsuranceProfileForm value={insurance} onChange={setInsurance} />
              <Button type="submit" size="lg" className="w-full mt-5">
                המשך לבחירת תור <ArrowLeft className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}

        {step === 3 && selectedProvider && insurancePhase === "otp-sms" && (
          <motion.div key="step3-otp-sms" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button onClick={() => setInsurancePhase("form")} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> חזרה
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">אימות דו-שלבי (1/2)</h2>
              <p className="text-slate-500 text-sm mt-1">
                לצורך אבטחת המידע הרפואי, נדרש אימות נוסף לפני סיום ההרשמה — קוד שנשלח ב-SMS וקוד נוסף באימייל.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {otpError && (
                <div className="mb-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
                  {otpError}
                </div>
              )}
              <form onSubmit={handleVerifyBookingSms} className="flex flex-col gap-3">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  label="קוד מ-SMS"
                  value={bookingSmsCode}
                  onChange={(e) => setBookingSmsCode(e.target.value)}
                  className="text-center tracking-[0.4em] text-lg"
                  required
                />
                <Button type="submit" size="lg" className="w-full mt-2">
                  אמת קוד SMS
                </Button>
                <button type="button" onClick={handleResendBookingSms} className="text-sm text-primary hover:underline">
                  שלח קוד מחדש
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {step === 3 && selectedProvider && insurancePhase === "otp-email" && (
          <motion.div key="step3-otp-email" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">אימות דו-שלבי (2/2)</h2>
              <p className="text-slate-500 text-sm mt-1">שלחנו קוד אימות נוסף לכתובת האימייל שלך</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {otpError && (
                <div className="mb-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
                  {otpError}
                </div>
              )}
              <form onSubmit={handleVerifyBookingEmail} className="flex flex-col gap-3">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  label="קוד מהאימייל"
                  value={bookingEmailCode}
                  onChange={(e) => setBookingEmailCode(e.target.value)}
                  className="text-center tracking-[0.4em] text-lg"
                  required
                />
                <Button type="submit" size="lg" className="w-full mt-2">
                  אמת קוד והמשך לבחירת תור <ArrowLeft className="h-4 w-4" />
                </Button>
                <button type="button" onClick={handleResendBookingEmail} className="text-sm text-primary hover:underline">
                  שלח קוד מחדש
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {step === 4 && selectedProvider && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <button onClick={() => setStep(3)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> חזרה
            </button>
            <SlotPicker
              provider={selectedProvider}
              appointments={appointments}
              onSelectSlot={selectSlot}
              onJoinWaitlist={(date, time, label) => setWaitlistSlot({ date, time, label })}
            />
          </motion.div>
        )}

        {step === 5 && selectedProvider && selectedSlot && holdExpiresAt && (
          <motion.div key="step5" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button
              onClick={() => {
                abandonHold();
                setStep(4);
              }}
              className="text-sm text-primary mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-3.5 w-3.5" /> שינוי תור
            </button>
            <PaymentPanel
              provider={selectedProvider}
              selectedSlot={selectedSlot}
              kupah={insurance.kupah}
              layer={resolvedPrice?.layer}
              price={price}
              holdExpiresAt={holdExpiresAt}
              onExpire={handleHoldExpire}
              payMethod={payMethod}
              onPayMethodChange={setPayMethod}
              paying={paying}
              onPay={handlePay}
            />
          </motion.div>
        )}

        {step === 6 && confirmation && selectedProvider && selectedSlot && pendingAppointmentId && (
          <motion.div key="step6" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <BookingConfirmation
              provider={selectedProvider}
              selectedSlot={selectedSlot}
              confirmation={confirmation}
              homeHref="/client"
              homeLabel="לאזור האישי שלי"
              appointmentId={pendingAppointmentId}
              pendingQuestionnaire={pendingQuestionnaire}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      <WaitlistJoinDialog
        provider={selectedProvider}
        slot={waitlistSlot}
        onClose={() => setWaitlistSlot(null)}
        clientName={leadForm.full_name || "מטופל"}
        clientPhone={leadForm.phone}
        createdById={patient?.id ?? currentUser?.id}
      />
    </div>
  );
}
