"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Stethoscope,
  Languages,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  User as UserIcon,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Calendar,
  FileText,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveProviderPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Logo } from "@/components/shared/Logo";
import { BookingStepper } from "@/components/book/BookingStepper";
import { DoctorCard } from "@/components/book/DoctorCard";
import { HoldTimer } from "@/components/book/HoldTimer";
import { EmptyState } from "@/components/ui/Misc";
import { formatCurrency, buildIcsDataUrl } from "@/lib/utils";
import { KUPAH_LOGOS } from "@/lib/medical-tree";
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
import { KUPOT, Kupah, LAYER_LABELS, ProviderProfile } from "@/types";

const HOLD_SECONDS = 180;

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};
const stepTransition = { duration: 0.25, ease: "easeOut" as const };

interface DaySlots {
  date: string;
  label: string;
  slots: { time: string; available: boolean }[];
}

function buildDays(): DaySlots[] {
  const hours = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];
  return Array.from({ length: 6 }, (_, dayIdx) => {
    const d = new Date();
    d.setDate(d.getDate() + dayIdx + 1);
    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
    const slots = hours.map((time, i) => ({
      time,
      available: (i + dayIdx) % 3 !== 0,
    }));
    return { date, label, slots };
  });
}

export default function BookPage() {
  const providers = useStore((s) => s.providers);
  const quickRegisterPatient = useStore((s) => s.quickRegisterPatient);
  const addAppointment = useStore((s) => s.addAppointment);
  const addOrder = useStore((s) => s.addOrder);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  const [step, setStep] = useState(0);

  // Step 0: discovery filters
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [language, setLanguage] = useState("");
  const [kupah, setKupah] = useState<Kupah | "">("");

  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);

  // Step 1: lead capture
  const [leadForm, setLeadForm] = useState({ full_name: "", phone: "", email: "" });

  // Step 2: consent (§4.2, §11.1)
  const [consents, setConsents] = useState<ConsentValues>({});

  // Step 3: insurance profile (§4.3, §7.1)
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);

  // Step 4: slot selection + hold
  const [days] = useState<DaySlots[]>(() => buildDays());
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; label: string } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);

  // Step 5: payment
  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);

  // Step 6: result
  const [confirmation, setConfirmation] = useState<{
    fileNumber: string;
    price: number;
    icsUrl: string;
  } | null>(null);

  const publishedProviders = useMemo(() => providers.filter((p) => p.is_published), [providers]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    publishedProviders.forEach((p) => p.clinic_locations.forEach((c) => set.add(c.city)));
    return Array.from(set);
  }, [publishedProviders]);

  const specialties = useMemo(
    () => Array.from(new Set(publishedProviders.map((p) => p.specialty).filter(Boolean))),
    [publishedProviders]
  );

  const languages = useMemo(() => {
    const set = new Set<string>();
    publishedProviders.forEach((p) => (p.languages ?? []).forEach((l) => set.add(l)));
    return Array.from(set);
  }, [publishedProviders]);

  const filteredProviders = useMemo(() => {
    return publishedProviders.filter((p) => {
      if (city && !p.clinic_locations.some((c) => c.city === city)) return false;
      if (specialty && p.specialty !== specialty) return false;
      if (language && !(p.languages ?? []).includes(language)) return false;
      if (
        kupah &&
        !p.agreements.some(
          (a) => (a.layer === "S" || a.layer === "K") && (!a.kupah_list?.length || a.kupah_list.includes(kupah))
        )
      )
        return false;
      if (query && !`${p.display_name} ${p.specialty}`.includes(query)) return false;
      return true;
    });
  }, [publishedProviders, city, specialty, language, kupah, query]);

  const consultation = selectedProvider?.consultation_types[0];
  const resolvedPrice = useMemo(() => {
    if (!consultation || !selectedProvider) return null;
    return resolveProviderPrice(consultation.prices, selectedProvider.agreements, patient);
  }, [consultation, selectedProvider, patient]);
  const price = resolvedPrice?.price ?? consultation?.prices.find((p) => p.layer === "H")?.price ?? 0;

  // Only ever invoked from the slot button's onClick — safe to read the clock here.
  function selectSlot(date: string, time: string, label: string) {
    setSelectedSlot({ date, time, label });
    // eslint-disable-next-line react-hooks/purity -- event handler, not render logic
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(5);
  }

  const handleHoldExpire = useCallback(() => {
    showToast("ה-Hold פג", { description: "התור שוחרר. רוצה לנסות שוב?", variant: "destructive" });
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setStep(4);
  }, [showToast]);

  function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  function handleConsentContinue() {
    setInsurance((i) => ({ ...i, kupah: (kupah || i.kupah) as Kupah }));
    setStep(3);
  }

  function handleInsuranceSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  function handlePay() {
    if (!selectedProvider || !selectedSlot) return;
    setPaying(true);
    setTimeout(() => {
      const commissionRate = selectedProvider.commission_rate ?? 15;
      const commissionAmount = Math.round((price * commissionRate) / 100);
      addAppointment({
        client_name: leadForm.full_name,
        client_phone: leadForm.phone,
        provider_id: selectedProvider.id,
        provider_name: `${selectedProvider.title ?? ""} ${selectedProvider.display_name}`.trim(),
        service_name: consultation?.name ?? "ייעוץ",
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration_minutes: consultation?.duration_minutes ?? 30,
        status: "מאושר",
        kupah: insurance.kupah,
        notes: "",
      });
      addOrder({
        item_name: consultation?.name ?? "ייעוץ",
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.display_name,
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
          <Link href="/" className="text-sm text-slate-500 hover:text-primary">
            חזרה לדף הבית
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <BookingStepper step={step} />

        <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <div className="text-center mb-7">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">מצאו את הרופא המתאים לכם</h1>
              <p className="text-slate-500 mt-2">סננו לפי סניף, תחום, שפה וקופת חולים — ותוצאות מתעדכנות מיידית</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-8">
              <Input
                placeholder="חיפוש רופא / תחום..."
                icon={<Search className="h-4 w-4" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="lg:col-span-2"
              />
              <Select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">כל הסניפים</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                <option value="">כל התחומים</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select value={kupah} onChange={(e) => setKupah(e.target.value as Kupah | "")}>
                <option value="">כל הקופות</option>
                {KUPOT.map((k) => (
                  <option key={k} value={k}>
                    {KUPAH_LOGOS[k]} {k}
                  </option>
                ))}
              </Select>
            </div>

            {languages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 -mt-3">
                {languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(language === l ? "" : l)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      language === l ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Languages className="h-3 w-3" /> {l}
                  </button>
                ))}
              </div>
            )}

            {filteredProviders.length === 0 ? (
              <EmptyState icon={<Stethoscope className="h-10 w-10" />} title="לא נמצאו רופאים מתאימים" description="נסו לשנות את הסינון" />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredProviders.map((p) => (
                  <DoctorCard
                    key={p.id}
                    provider={p}
                    patient={patient}
                    onSelect={() => {
                      setSelectedProvider(p);
                      setStep(1);
                    }}
                  />
                ))}
              </div>
            )}
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setLeadForm({ full_name: "נועה כהן", phone: "050-1234567", email: "noa@example.co.il" })}>
                  המשך עם Google
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setLeadForm({ full_name: "נועה כהן", phone: "050-1234567", email: "noa@example.co.il" })}>
                  המשך עם Apple
                </Button>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-xs text-slate-400">או הזינו פרטים</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <form onSubmit={handleLeadSubmit} className="flex flex-col gap-3">
                <Input
                  placeholder="שם מלא"
                  icon={<UserIcon className="h-4 w-4" />}
                  value={leadForm.full_name}
                  onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })}
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

        {step === 3 && selectedProvider && (
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

        {step === 4 && selectedProvider && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <button onClick={() => setStep(3)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> חזרה
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">בחרו תאריך ושעה</h2>
              <p className="text-slate-500 text-sm mt-1">
                זמינות אצל {selectedProvider.title} {selectedProvider.display_name}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {days.map((d, i) => (
                <button
                  key={d.date}
                  onClick={() => setActiveDayIdx(i)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    activeDayIdx === i ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {days[activeDayIdx].slots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => selectSlot(days[activeDayIdx].date, slot.time, days[activeDayIdx].label)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    slot.available
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:-translate-y-0.5"
                      : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-100 border border-emerald-200" /> פנוי</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-200" /> תפוס</span>
            </div>
          </motion.div>
        )}

        {step === 5 && selectedProvider && selectedSlot && holdExpiresAt && (
          <motion.div key="step5" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button onClick={() => setStep(4)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> שינוי תור
            </button>
            <div className="text-center mb-4">
              <HoldTimer expiresAt={holdExpiresAt} onExpire={handleHoldExpire} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-5">
              <p className="text-xs text-slate-400 mb-2">סיכום ההזמנה</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">רופא</span>
                <span className="font-medium text-slate-900">
                  {selectedProvider.title} {selectedProvider.display_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-500">תאריך ושעה</span>
                <span className="font-medium text-slate-900">
                  {selectedSlot.label} · {selectedSlot.time}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-500">קופת חולים</span>
                <span className="font-medium text-slate-900">{insurance.kupah}</span>
              </div>
              {resolvedPrice && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-500">שכבת ביטוח</span>
                  <span className="font-medium text-emerald-700">{LAYER_LABELS[resolvedPrice.layer]}</span>
                </div>
              )}
              <div className="h-px bg-slate-100 my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">מקדמה לתשלום</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(price)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">אמצעי תשלום</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setPayMethod("card")}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                  <CreditCard className="h-4 w-4" /> כרטיס אשראי
                </button>
                <button
                  onClick={() => setPayMethod("apple")}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "apple" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                  <Smartphone className="h-4 w-4" /> Apple Pay
                </button>
                <button
                  onClick={() => setPayMethod("google")}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "google" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                  <Smartphone className="h-4 w-4" /> Google Pay
                </button>
              </div>
              {payMethod === "card" && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="col-span-2">
                    <Input placeholder="מספר כרטיס" dir="ltr" defaultValue="4580 •••• •••• 1234" />
                  </div>
                  <Input placeholder="MM/YY" dir="ltr" defaultValue="08/28" />
                  <Input placeholder="CVV" dir="ltr" defaultValue="•••" />
                </div>
              )}
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
                <ShieldCheck className="h-3.5 w-3.5" /> תשלום מאובטח בתקן PCI DSS · מצב הדגמה, לא מתבצע חיוב אמיתי
              </p>
              <Button size="lg" className="w-full" loading={paying} onClick={handlePay}>
                שלם {formatCurrency(price)} ואשר תור
              </Button>
            </div>
          </motion.div>
        )}

        {step === 6 && confirmation && selectedProvider && selectedSlot && (
          <motion.div key="step6" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto text-center">
            <ConfettiBurst />
            <motion.div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
            >
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-900">התור נקבע בהצלחה! 🎉</h2>
            <p className="text-slate-500 mt-2">
              {selectedProvider.title} {selectedProvider.display_name} · {selectedSlot.label} בשעה {selectedSlot.time}
            </p>
            <p className="text-xs text-slate-400 mt-1">מספר תיק לקוח #{confirmation.fileNumber}</p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
              <a href={confirmation.icsUrl} download="appointment.ics">
                <Button variant="outline">
                  <Calendar className="h-4 w-4" /> הוסף ליומן
                </Button>
              </a>
              <Button
                variant="outline"
                onClick={() => showToast("תזכורת נשלחה בוואטסאפ ובמייל", { variant: "success" })}
              >
                <Sparkles className="h-4 w-4" /> שלחו לי תזכורת
              </Button>
              <Link href="/client">
                <Button>
                  לאזור האישי שלי <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <FileText className="h-4 w-4 text-primary" /> מה קורה עכשיו
              </p>
              <ul className="flex flex-col gap-2.5 text-sm text-slate-500">
                <li className="flex items-center justify-between">
                  <span>תזכורת + צ׳קליסט להגעה</span>
                  <span className="text-xs text-slate-400">24 שעות לפני</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>תזכורת אחרונה + קישור להעלאת מסמכים</span>
                  <span className="text-xs text-slate-400">שעתיים לפני</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>ביקור, תשלום וקבלה דיגיטלית</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><PartyPopper className="h-3 w-3" /> ביום התור</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>סיכום ביקור + דירוג חוויה</span>
                  <span className="text-xs text-slate-400">יומיים אחרי</span>
                </li>
              </ul>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Deterministic (not Math.random) so it stays pure during render — the
// spread still reads as organic confetti thanks to the sine-based offsets.
const CONFETTI_COLORS = ["#0d7d6f", "#c8973a", "#10b981", "#6366f1", "#ec4899"];
const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: Math.sin(i * 2.4) * 110,
  y: 90 + ((i * 17) % 40),
  rotate: (i * 53) % 360,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: (i % 6) * 0.025,
}));

function ConfettiBurst() {
  const pieces = CONFETTI_PIECES;
  return (
    <div className="relative h-0 w-full pointer-events-none">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 left-1/2 h-2 w-2 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 1, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
