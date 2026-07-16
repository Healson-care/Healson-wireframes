import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  Appointment,
  CatalogItem,
  ConsentRecord,
  ConsentType,
  CONSENT_DOCUMENT_VERSION,
  DsrRequest,
  DsrRequestStatus,
  Kupah,
  KLevel,
  Lead,
  LabReferral,
  Order,
  Patient,
  PatientDocument,
  ProviderProfile,
  Role,
  ServiceType,
  SkillDomain,
  SkillSubdomain,
  ToastItem,
  UploadedFile,
  User,
  VisitRecord,
  WaitlistEntry,
} from "@/types";
import {
  DEMO_NEW_PATIENT_USER,
  SEED_APPOINTMENTS,
  SEED_BRANCHES,
  SEED_CATALOG,
  SEED_CONSENT_RECORDS,
  SEED_DOCUMENTS,
  SEED_DSR_REQUESTS,
  SEED_LAB_REFERRALS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_PATIENTS,
  SEED_PROVIDERS,
  SEED_USERS,
  SEED_VISIT_RECORDS,
} from "./mock-data";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "./medical-tree";
import { generateId } from "./utils";

// ---------------------------------------------------------------------------
// Auth slice
// ---------------------------------------------------------------------------
interface PendingRegistration {
  email: string;
  password: string;
  otp: string;
}

// Held between the provider clicking "שלח לבדיקת Healson" on /apply (which
// re-checks license-number uniqueness against the profile's already-saved
// fields — see submitProviderApplication) and phone-OTP verification. Unlike
// the old PendingProviderApplication, no applicant data lives here: by this
// point the ProviderProfile already exists and has been filled in
// incrementally (the applicant registered + logged in back at step 1).
interface PendingProviderSubmission {
  providerId: string;
  otp: string;
}

interface PendingLoginVerification {
  userId: string;
  smsOtp: string;
  emailOtp: string;
  smsVerified: boolean;
}

interface PendingRegistrationVerification {
  smsOtp: string;
  emailOtp: string;
  smsVerified: boolean;
}

export interface InsuranceProfileInput {
  kupah: Kupah;
  k_level?: KLevel;
  has_b_insurance?: boolean;
  b_insurance_company?: string;
  b_policy_number?: string;
  address?: string;
}

export type RegistrationConsents = Partial<Record<ConsentType, boolean>>;

interface AuthState {
  currentUser: User | null;
  pendingRegistration: PendingRegistration | null;
  pendingProviderSubmission: PendingProviderSubmission | null;
  pendingLoginVerification: PendingLoginVerification | null;
  login: (email: string, password: string) => { ok: boolean; error?: string; requiresOtp?: boolean };
  verifyLoginSmsOtp: (code: string) => { ok: boolean; error?: string };
  verifyLoginEmailOtp: (code: string) => { ok: boolean; error?: string };
  resendLoginOtp: (channel: "sms" | "email") => string | null;
  pendingRegistrationVerification: PendingRegistrationVerification | null;
  beginRegistrationVerification: () => void;
  verifyRegistrationSmsOtp: (code: string) => { ok: boolean; error?: string };
  verifyRegistrationEmailOtp: (code: string) => { ok: boolean; error?: string };
  resendRegistrationOtp: (channel: "sms" | "email") => string | null;
  loginWithGoogle: () => void;
  register: (email: string, password: string) => { ok: boolean; otpHint: string };
  verifyOtp: (email: string, code: string) => { ok: boolean; error?: string };
  resendOtp: () => string | null;
  // Provider signup step 1 — creates the User + a bare ProviderProfile and
  // logs the applicant in immediately (mirrors register/verifyOtp above),
  // instead of waiting until Ops verifies the license (see PROV-ONBOARDING).
  registerProviderAccount: (
    full_name: string,
    phone: string,
    email: string,
    password: string
  ) => { ok: boolean; error?: string };
  // Provider signup step 4 — called once the applicant has filled out their
  // profile (already persisted incrementally via upsertProviderProfile) and
  // clicks "שלח לבדיקת Healson". Re-checks license-number uniqueness and
  // stages phone-OTP verification before flipping application_submitted_at.
  submitProviderApplication: (providerId: string) => { ok: boolean; error?: string; otpHint?: string };
  verifyProviderApplicationOtp: (code: string) => { ok: boolean; error?: string; providerId?: string };
  resendProviderApplicationOtp: () => string | null;
  forgotPassword: (email: string) => { ok: boolean };
  resetPassword: (newPassword: string) => { ok: boolean };
  logout: () => void;
  loginAsDemo: (role: Role, patientVariant?: "new" | "existing") => void;
  completePatientRegistration: (
    userId: string,
    data: {
      full_name: string;
      phone?: string;
      id_number: string;
      id_document_type?: "id" | "passport";
      id_document_photo?: UploadedFile;
      date_of_birth: string;
      parent_name?: string;
    } & InsuranceProfileInput,
    consents: RegistrationConsents
  ) => Patient;
}

// ---------------------------------------------------------------------------
// Toast slice
// ---------------------------------------------------------------------------
interface ToastState {
  toasts: ToastItem[];
  showToast: (title: string, opts?: { description?: string; variant?: ToastItem["variant"] }) => void;
  dismissToast: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Entities slice
// ---------------------------------------------------------------------------
interface EntitiesState {
  users: User[];
  patients: Patient[];
  leads: Lead[];
  providers: ProviderProfile[];
  catalog: CatalogItem[];
  skillDomains: SkillDomain[];
  skillSubdomains: SkillSubdomain[];
  appointments: Appointment[];
  orders: Order[];
  labReferrals: LabReferral[];
  visitRecords: VisitRecord[];
  documents: PatientDocument[];
  waitlist: WaitlistEntry[];
  branches: typeof SEED_BRANCHES;
  consentRecords: ConsentRecord[];
  dsrRequests: DsrRequest[];
  defaultCommissionRate: number;
  commissionRateByServiceType: Partial<Record<ServiceType, number>>;

  addPatient: (p: Omit<Patient, "id" | "created_date">) => Patient;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  addLead: (l: Omit<Lead, "id" | "created_date">) => Lead;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  convertLead: (id: string) => Patient | undefined;

  addAdminUser: (data: { full_name: string; email: string; phone?: string }) => User;

  upsertProviderProfile: (
    userId: string | undefined,
    data: Partial<ProviderProfile>
  ) => ProviderProfile;
  updateProviderById: (id: string, data: Partial<ProviderProfile>) => void;
  verifyProviderLicense: (id: string) => void;
  demoApproveProvider: (id: string) => void;
  demoRejectProvider: (id: string, reason?: string) => void;
  rejectProvider: (id: string, reason: string) => void;
  requestProviderChanges: (id: string, reason: string) => void;
  requestProviderGoLive: (id: string) => void;
  approveProviderGoLive: (id: string) => void;
  suspendProvider: (id: string) => void;
  reinstateProvider: (id: string) => void;
  signProviderAgreement: (id: string) => void;
  setProviderCommission: (id: string, rate: number) => void;
  setDefaultCommissionRate: (rate: number) => void;
  setServiceTypeCommissionRate: (type: ServiceType, rate: number | undefined) => void;

  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  addOrder: (o: Omit<Order, "id" | "created_date">) => Order;
  updateOrder: (id: string, data: Partial<Order>) => void;

  addLabReferral: (r: Omit<LabReferral, "id" | "created_date">) => LabReferral;
  updateLabReferral: (id: string, data: Partial<LabReferral>) => void;

  addVisitRecord: (v: Omit<VisitRecord, "id" | "created_date">) => VisitRecord;
  updateVisitRecord: (id: string, data: Partial<VisitRecord>) => void;
  addDocument: (d: Omit<PatientDocument, "id" | "created_date">) => PatientDocument;
  updateDocument: (id: string, data: Partial<PatientDocument>) => void;

  addWaitlistEntry: (w: Omit<WaitlistEntry, "id" | "created_date" | "status">) => WaitlistEntry;

  addCatalogItem: (c: Omit<CatalogItem, "id">) => CatalogItem;
  updateCatalogItem: (id: string, data: Partial<CatalogItem>) => void;
  deleteCatalogItem: (id: string) => void;
  bulkAddCatalogItems: (items: Omit<CatalogItem, "id">[]) => number;
  bulkDeleteCatalogItems: (ids: string[]) => void;
  bulkSetCatalogItemsActive: (ids: string[], is_active: boolean) => void;
  bulkAddProviders: (items: Omit<ProviderProfile, "id" | "created_date">[]) => number;

  addSkillDomain: (d: Omit<SkillDomain, "id">) => SkillDomain;
  updateSkillDomain: (id: string, data: Partial<SkillDomain>) => void;
  deleteSkillDomain: (id: string) => void;
  addSkillSubdomain: (s: Omit<SkillSubdomain, "id">) => SkillSubdomain;
  updateSkillSubdomain: (id: string, data: Partial<SkillSubdomain>) => void;
  deleteSkillSubdomain: (id: string) => void;

  grantConsent: (patientId: string, type: ConsentType, version?: string) => ConsentRecord;
  revokeConsent: (recordId: string) => void;
  getPatientConsents: (patientId: string) => ConsentRecord[];

  addDsrRequest: (r: Omit<DsrRequest, "id" | "requested_at" | "status"> & { status?: DsrRequestStatus }) => DsrRequest;
  updateDsrRequest: (id: string, data: Partial<DsrRequest>) => void;
  exportPatientData: (patientId: string) => Record<string, unknown> | null;
}

interface HydrationState {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

type Store = AuthState & ToastState & EntitiesState & HydrationState;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ---------------- Hydration ----------------
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      // ---------------- Auth ----------------
      currentUser: null,
      pendingRegistration: null,
      pendingProviderSubmission: null,
      pendingLoginVerification: null,
      pendingRegistrationVerification: null,

      login: (email, password) => {
        if (!email || !password) return { ok: false, error: "נא להזין אימייל וסיסמה" };
        const existing = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          if (existing.role === "provider") {
            const provider = get().providers.find((p) => p.user_id === existing.id);
            // pending_review no longer blocks login (PROV-REGISTRATION) — the
            // provider already has a session from registerProviderAccount and
            // ProviderLayout routes them to /provider/register to finish or await review.
            if (provider?.status === "rejected") {
              return {
                ok: false,
                error: provider.rejection_reason
                  ? `בקשתך נדחתה: ${provider.rejection_reason}`
                  : "בקשתך להצטרפות נדחתה.",
              };
            }
            if (provider?.status === "suspended") {
              return { ok: false, error: "חשבון הספק מושהה זמנית. אנא פנה לתמיכה." };
            }
          }
          // Policy: an existing patient (already has a Patient record, i.e.
          // finished registration) must clear a double OTP step-up — SMS
          // then email — before the personal area unlocks. Demo-only: the
          // codes are fixed, nothing is actually sent.
          const isExistingPatient =
            existing.role === "patient" && get().patients.some((p) => p.user_id === existing.id);
          if (isExistingPatient) {
            set({
              pendingLoginVerification: {
                userId: existing.id,
                smsOtp: "123456",
                emailOtp: "654321",
                smsVerified: false,
              },
            });
            return { ok: true, requiresOtp: true };
          }
          set({ currentUser: existing });
          return { ok: true };
        }
        // Unknown email -> mock-create a new patient account on the fly.
        const newUser: User = {
          id: generateId("user"),
          email,
          full_name: email.split("@")[0],
          role: "patient",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser], currentUser: newUser }));
        get().addPatient({
          full_name: newUser.full_name,
          email: newUser.email,
          kupah: "כללית",
          status: "פעיל",
          user_id: newUser.id,
        });
        return { ok: true };
      },

      loginWithGoogle: () => {
        get().loginAsDemo("patient");
      },

      loginAsDemo: (role, patientVariant) => {
        if (role === "patient" && patientVariant === "new") {
          // Reset the demo "new patient" account to a pristine lead on every
          // click — otherwise completing registration once (which links a
          // Patient record and overwrites the name/phone on this fixed demo
          // id) would permanently turn it into an "existing patient" for
          // every future demo run, making the lead flow undemonstrable.
          set((s) => ({
            users: s.users.map((u) => (u.id === DEMO_NEW_PATIENT_USER.id ? { ...DEMO_NEW_PATIENT_USER } : u)),
            patients: s.patients.filter((p) => p.user_id !== DEMO_NEW_PATIENT_USER.id),
            currentUser: { ...DEMO_NEW_PATIENT_USER },
          }));
          return;
        }
        const user = get().users.find((u) => u.role === role) ?? null;
        // Demo shortcut for an existing patient still has to clear the
        // double OTP gate, same as the real login form — otherwise the
        // wireframe would show the policy inconsistently to whoever is
        // running the demo.
        if (user && role === "patient" && get().patients.some((p) => p.user_id === user.id)) {
          set({
            pendingLoginVerification: {
              userId: user.id,
              smsOtp: "123456",
              emailOtp: "654321",
              smsVerified: false,
            },
          });
          return;
        }
        set({ currentUser: user });
      },

      verifyLoginSmsOtp: (code) => {
        const pending = get().pendingLoginVerification;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.smsOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingLoginVerification: { ...pending, smsVerified: true } });
        return { ok: true };
      },

      verifyLoginEmailOtp: (code) => {
        const pending = get().pendingLoginVerification;
        if (!pending || !pending.smsVerified) {
          return { ok: false, error: "יש לאמת קודם את הקוד שנשלח ב-SMS" };
        }
        if (code !== pending.emailOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        const user = get().users.find((u) => u.id === pending.userId) ?? null;
        set({ currentUser: user, pendingLoginVerification: null });
        return { ok: true };
      },

      resendLoginOtp: (channel) => {
        const pending = get().pendingLoginVerification;
        if (!pending) return null;
        return channel === "sms" ? pending.smsOtp : pending.emailOtp;
      },

      // Policy: a new patient must also clear the SMS+email double OTP —
      // as the very last step, right before they become a registered
      // patient — same as the step-up an existing patient clears at login.
      // Demo-only: fixed codes, nothing is actually sent.
      beginRegistrationVerification: () => {
        set({
          pendingRegistrationVerification: { smsOtp: "123456", emailOtp: "654321", smsVerified: false },
        });
      },

      verifyRegistrationSmsOtp: (code) => {
        const pending = get().pendingRegistrationVerification;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.smsOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingRegistrationVerification: { ...pending, smsVerified: true } });
        return { ok: true };
      },

      verifyRegistrationEmailOtp: (code) => {
        const pending = get().pendingRegistrationVerification;
        if (!pending || !pending.smsVerified) {
          return { ok: false, error: "יש לאמת קודם את הקוד שנשלח ב-SMS" };
        }
        if (code !== pending.emailOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingRegistrationVerification: null });
        return { ok: true };
      },

      resendRegistrationOtp: (channel) => {
        const pending = get().pendingRegistrationVerification;
        if (!pending) return null;
        return channel === "sms" ? pending.smsOtp : pending.emailOtp;
      },

      register: (email, password) => {
        const otp = "123456";
        set({ pendingRegistration: { email, password, otp } });
        return { ok: true, otpHint: otp };
      },

      verifyOtp: (email, code) => {
        const pending = get().pendingRegistration;
        if (!pending || pending.email !== email) {
          return { ok: false, error: "לא נמצאה הרשמה פעילה" };
        }
        if (code !== pending.otp) {
          return { ok: false, error: "קוד שגוי, נסה שנית" };
        }
        const newUser: User = {
          id: generateId("user"),
          email: pending.email,
          full_name: pending.email.split("@")[0],
          role: "patient",
          created_date: new Date().toISOString(),
        };
        set((s) => ({
          users: [...s.users, newUser],
          currentUser: newUser,
          pendingRegistration: null,
        }));
        // Note: the Patient record (insurance profile + consent) is created
        // afterwards via completePatientRegistration, once the multi-step
        // /register flow collects those fields (§4.2).
        return { ok: true };
      },

      resendOtp: () => {
        const pending = get().pendingRegistration;
        return pending ? pending.otp : null;
      },

      registerProviderAccount: (full_name, phone, email, password) => {
        void password; // mocked — no real auth/password storage anywhere in this app (see login())
        const emailTaken = get().users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        if (emailTaken) return { ok: false, error: "כתובת האימייל כבר רשומה במערכת" };
        const newUser: User = {
          id: generateId("user"),
          email,
          full_name,
          phone,
          role: "provider",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser] }));
        get().upsertProviderProfile(newUser.id, { display_name: full_name });
        // Logged in immediately (PROV-REGISTRATION) — unlike the old
        // apply-then-wait-for-Ops flow, the applicant gets a real session
        // the moment their account exists and completes the rest of their
        // profile (type/details/documents/submit) on /apply while already
        // authenticated, mirroring register()/verifyOtp() for patients.
        set({ currentUser: newUser });
        return { ok: true };
      },

      submitProviderApplication: (providerId) => {
        const provider = get().providers.find((p) => p.id === providerId);
        if (!provider) return { ok: false, error: "לא נמצא פרופיל ספק" };
        const licenseTaken =
          !!provider.license_number &&
          get().providers.some(
            (p) => p.id !== providerId && p.status !== "rejected" && p.license_number === provider.license_number
          );
        if (licenseTaken) return { ok: false, error: "מספר הרישיון כבר רשום במערכת" };
        const otp = "123456";
        set({ pendingProviderSubmission: { providerId, otp } });
        return { ok: true, otpHint: otp };
      },

      verifyProviderApplicationOtp: (code) => {
        const pending = get().pendingProviderSubmission;
        if (!pending) return { ok: false, error: "לא נמצאה בקשת הצטרפות פעילה" };
        if (code !== pending.otp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        get().updateProviderById(pending.providerId, {
          phone_verified_at: new Date().toISOString(),
          application_submitted_at: new Date().toISOString(),
        });
        set({ pendingProviderSubmission: null });
        return { ok: true, providerId: pending.providerId };
      },

      resendProviderApplicationOtp: () => {
        const pending = get().pendingProviderSubmission;
        return pending ? pending.otp : null;
      },

      forgotPassword: () => ({ ok: true }),
      resetPassword: () => ({ ok: true }),

      logout: () => set({ currentUser: null }),

      completePatientRegistration: (userId, data, consents) => {
        set((s) => ({
          users: s.users.map((u) =>
            u.id === userId ? { ...u, full_name: data.full_name || u.full_name, phone: data.phone ?? u.phone } : u
          ),
        }));
        const user = get().users.find((u) => u.id === userId);
        const patient = get().addPatient({
          full_name: data.full_name,
          email: user?.email,
          phone: data.phone,
          id_number: data.id_number,
          id_document_type: data.id_document_type,
          id_document_photo: data.id_document_photo,
          date_of_birth: data.date_of_birth,
          parent_name: data.parent_name,
          address: data.address,
          kupah: data.kupah,
          k_level: data.k_level,
          has_b_insurance: data.has_b_insurance,
          b_insurance_company: data.b_insurance_company,
          b_policy_number: data.b_policy_number,
          status: "פעיל",
          user_id: userId,
        });
        (Object.keys(consents) as ConsentType[]).forEach((type) => {
          if (consents[type]) get().grantConsent(patient.id, type, CONSENT_DOCUMENT_VERSION);
        });
        return patient;
      },

      // ---------------- Toasts ----------------
      toasts: [],
      showToast: (title, opts) => {
        const id = generateId("toast");
        set((s) => ({
          toasts: [...s.toasts, { id, title, description: opts?.description, variant: opts?.variant ?? "default" }],
        }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ---------------- Entities ----------------
      users: SEED_USERS,
      patients: SEED_PATIENTS,
      leads: SEED_LEADS,
      providers: SEED_PROVIDERS,
      catalog: SEED_CATALOG,
      skillDomains: SEED_SKILL_DOMAINS,
      skillSubdomains: SEED_SKILL_SUBDOMAINS,
      appointments: SEED_APPOINTMENTS,
      orders: SEED_ORDERS,
      labReferrals: SEED_LAB_REFERRALS,
      visitRecords: SEED_VISIT_RECORDS,
      documents: SEED_DOCUMENTS,
      waitlist: [],
      branches: SEED_BRANCHES,
      consentRecords: SEED_CONSENT_RECORDS,
      dsrRequests: SEED_DSR_REQUESTS,
      defaultCommissionRate: 15,
      commissionRateByServiceType: {},

      addPatient: (p) => {
        const record: Patient = { ...p, id: generateId("pat"), created_date: new Date().toISOString() };
        set((s) => ({ patients: [record, ...s.patients] }));
        return record;
      },
      updatePatient: (id, data) =>
        set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, ...data } : p)) })),
      deletePatient: (id) => set((s) => ({ patients: s.patients.filter((p) => p.id !== id) })),

      addLead: (l) => {
        const record: Lead = { ...l, id: generateId("lead"), created_date: new Date().toISOString() };
        set((s) => ({ leads: [record, ...s.leads] }));
        return record;
      },
      updateLead: (id, data) =>
        set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...data } : l)) })),
      deleteLead: (id) => set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),
      convertLead: (id) => {
        const lead = get().leads.find((l) => l.id === id);
        if (!lead) return undefined;
        const patient = get().addPatient({
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          kupah: "כללית",
          status: "פעיל",
        });
        get().updateLead(id, { status: "הומר", conversion_date: new Date().toISOString() });
        return patient;
      },

      addAdminUser: (data) => {
        const record: User = {
          id: generateId("user"),
          email: data.email,
          full_name: data.full_name,
          phone: data.phone,
          role: "admin",
          admin_title: "support_rep",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, record] }));
        return record;
      },

      updateProviderById: (id, data) =>
        set((s) => ({
          providers: s.providers.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, ...data };
            // Providers can only be published when fully approved. Keep the
            // model consistent even if a write path accidentally toggles
            // is_published while the provider is pending review or onboarding.
            if (updated.status !== "approved") {
              updated.is_published = false;
            }
            // Onboarding readiness (FEAT-06) is derived, not set by any single
            // screen — recompute it here so every write path (agreements,
            // catalog, calendars, linking, sign) stays in sync automatically.
            // Requires calendars ("יומנים") to exist AND at least one service
            // actually linked to one — a service defined before any calendar
            // exists doesn't count (see ServiceCatalogSection/PriceListSection's
            // "add a calendar first" flag).
            const allServices = [...updated.consultation_types, ...updated.exam_types];
            if (
              updated.status === "onboarding" &&
              !updated.onboarding_ready_at &&
              updated.agreements.length > 0 &&
              allServices.length > 0 &&
              updated.clinic_locations.length > 0 &&
              allServices.some((sv) => (sv.linked_clinic_ids?.length ?? 0) > 0) &&
              updated.agreement_signed_at
            ) {
              updated.onboarding_ready_at = new Date().toISOString();
            }
            return updated;
          }),
        })),

      verifyProviderLicense: (id) => {
        // No new credential is issued here (PROV-REGISTRATION) — the
        // provider already has their own account/session from
        // registerProviderAccount, so this just unlocks onboarding access.
        get().updateProviderById(id, {
          status: "onboarding",
          license_verified_at: new Date().toISOString(),
        });
      },
      // Demo shortcut (product-demo flow) — skips the real Ops license-review
      // + Go-Live pipeline entirely, dropping the applicant straight into
      // their own /provider/dashboard fully approved+published so they can
      // self-serve the rest of the setup (catalog/locations/availability).
      demoApproveProvider: (id) => {
        const provider = get().providers.find((p) => p.id === id);
        get().updateProviderById(id, {
          status: "approved",
          is_published: true,
          license_verified_at: new Date().toISOString(),
          rejection_reason: undefined,
        });
        const user = provider?.user_id ? get().users.find((u) => u.id === provider.user_id) : undefined;
        if (user) set({ currentUser: user });
      },
      demoRejectProvider: (id, reason) => {
        get().updateProviderById(id, {
          status: "rejected",
          rejection_reason: reason ?? "לצורך ההדגמה, צוות Healson דחה את הבקשה — נמצאו פערים במסמכים שצורפו.",
          is_published: false,
        });
      },
      rejectProvider: (id, reason) => {
        get().updateProviderById(id, { status: "rejected", rejection_reason: reason, is_published: false });
      },
      requestProviderChanges: (id, reason) => {
        get().updateProviderById(id, {
          status: "onboarding",
          rejection_reason: reason,
          onboarding_ready_at: undefined,
          go_live_requested_at: undefined,
        });
      },
      // Provider clicks "פרסם" once onboarding is complete — this only
      // queues the request; Healson still has to manually approve Go-Live
      // (approveProviderGoLive) before status/is_published actually change.
      requestProviderGoLive: (id) => {
        get().updateProviderById(id, { go_live_requested_at: new Date().toISOString() });
      },
      approveProviderGoLive: (id) => {
        get().updateProviderById(id, { status: "approved", is_published: true, rejection_reason: undefined });
      },
      suspendProvider: (id) => get().updateProviderById(id, { status: "suspended" }),
      reinstateProvider: (id) => get().updateProviderById(id, { status: "approved" }),
      signProviderAgreement: (id) => get().updateProviderById(id, { agreement_signed_at: new Date().toISOString() }),
      setProviderCommission: (id, rate) => get().updateProviderById(id, { commission_rate: rate }),
      setDefaultCommissionRate: (rate) => set({ defaultCommissionRate: rate }),
      setServiceTypeCommissionRate: (type, rate) =>
        set((s) => {
          const next = { ...s.commissionRateByServiceType };
          if (rate === undefined) delete next[type];
          else next[type] = rate;
          return { commissionRateByServiceType: next };
        }),

      upsertProviderProfile: (userId, data) => {
        const existing = userId ? get().providers.find((p) => p.user_id === userId) : undefined;
        if (existing) {
          get().updateProviderById(existing.id, data);
          return get().providers.find((p) => p.id === existing.id)!;
        }
        const record: ProviderProfile = {
          id: generateId("prov"),
          user_id: userId,
          display_name: data.display_name ?? "",
          specialty: data.specialty ?? "",
          is_published: false,
          status: "pending_review",
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
          ...data,
        };
        if (record.status !== "approved") {
          record.is_published = false;
        }
        set((s) => ({ providers: [...s.providers, record] }));
        return record;
      },

      addAppointment: (a) => {
        const record: Appointment = { ...a, id: generateId("appt") };
        set((s) => ({ appointments: [record, ...s.appointments] }));
        return record;
      },
      updateAppointment: (id, data) =>
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...data } : a)),
        })),
      deleteAppointment: (id) =>
        set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),

      addOrder: (o) => {
        const record: Order = { ...o, id: generateId("ord"), created_date: new Date().toISOString() };
        set((s) => ({ orders: [record, ...s.orders] }));
        return record;
      },
      updateOrder: (id, data) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...data } : o)) })),

      addLabReferral: (r) => {
        const record: LabReferral = { ...r, id: generateId("lab"), created_date: new Date().toISOString() };
        set((s) => ({ labReferrals: [record, ...s.labReferrals] }));
        return record;
      },
      updateLabReferral: (id, data) =>
        set((s) => ({
          labReferrals: s.labReferrals.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      addVisitRecord: (v) => {
        const record: VisitRecord = { ...v, id: generateId("visit"), created_date: new Date().toISOString() };
        set((s) => ({ visitRecords: [record, ...s.visitRecords] }));
        return record;
      },
      updateVisitRecord: (id, data) =>
        set((s) => ({
          visitRecords: s.visitRecords.map((v) => (v.id === id ? { ...v, ...data } : v)),
        })),
      addDocument: (d) => {
        const record: PatientDocument = { ...d, id: generateId("doc"), created_date: new Date().toISOString() };
        set((s) => ({ documents: [record, ...s.documents] }));
        return record;
      },
      updateDocument: (id, data) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...data } : d)),
        })),

      addWaitlistEntry: (w) => {
        const record: WaitlistEntry = { ...w, id: generateId("wait"), status: "ממתין", created_date: new Date().toISOString() };
        set((s) => ({ waitlist: [record, ...s.waitlist] }));
        return record;
      },

      addCatalogItem: (c) => {
        const record: CatalogItem = { ...c, id: generateId("cat") };
        set((s) => ({ catalog: [record, ...s.catalog] }));
        return record;
      },
      updateCatalogItem: (id, data) =>
        set((s) => ({ catalog: s.catalog.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
      deleteCatalogItem: (id) => set((s) => ({ catalog: s.catalog.filter((c) => c.id !== id) })),
      bulkAddCatalogItems: (items) => {
        const records = items.map((c) => ({ ...c, id: generateId("cat") }));
        set((s) => ({ catalog: [...records, ...s.catalog] }));
        return records.length;
      },
      bulkDeleteCatalogItems: (ids) => {
        const idSet = new Set(ids);
        set((s) => ({ catalog: s.catalog.filter((c) => !idSet.has(c.id)) }));
      },
      bulkSetCatalogItemsActive: (ids, is_active) => {
        const idSet = new Set(ids);
        set((s) => ({ catalog: s.catalog.map((c) => (idSet.has(c.id) ? { ...c, is_active } : c)) }));
      },
      bulkAddProviders: (items) => {
        const records = items.map((p) => ({
          ...p,
          id: generateId("prov"),
          created_date: new Date().toISOString(),
        }));
        set((s) => ({ providers: [...records, ...s.providers] }));
        return records.length;
      },

      addSkillDomain: (d) => {
        const record: SkillDomain = { ...d, id: generateId("dom") };
        set((s) => ({ skillDomains: [...s.skillDomains, record] }));
        return record;
      },
      updateSkillDomain: (id, data) =>
        set((s) => ({ skillDomains: s.skillDomains.map((d) => (d.id === id ? { ...d, ...data } : d)) })),
      deleteSkillDomain: (id) =>
        set((s) => ({
          skillDomains: s.skillDomains.filter((d) => d.id !== id),
          skillSubdomains: s.skillSubdomains.filter((sd) => sd.domain_id !== id),
          catalog: s.catalog.filter((c) => c.skill_domain_id !== id),
        })),
      addSkillSubdomain: (sd) => {
        const record: SkillSubdomain = { ...sd, id: generateId("sub") };
        set((s) => ({ skillSubdomains: [...s.skillSubdomains, record] }));
        return record;
      },
      updateSkillSubdomain: (id, data) =>
        set((s) => ({ skillSubdomains: s.skillSubdomains.map((sd) => (sd.id === id ? { ...sd, ...data } : sd)) })),
      deleteSkillSubdomain: (id) =>
        set((s) => ({
          skillSubdomains: s.skillSubdomains.filter((sd) => sd.id !== id),
          catalog: s.catalog.filter((c) => c.skill_subdomain_id !== id),
        })),

      grantConsent: (patientId, type, version = CONSENT_DOCUMENT_VERSION) => {
        const record: ConsentRecord = {
          id: generateId("consent"),
          patient_id: patientId,
          consent_type: type,
          version,
          granted: true,
          granted_at: new Date().toISOString(),
        };
        set((s) => ({ consentRecords: [record, ...s.consentRecords] }));
        return record;
      },
      revokeConsent: (recordId) =>
        set((s) => ({
          consentRecords: s.consentRecords.map((c) =>
            c.id === recordId ? { ...c, revoked_at: new Date().toISOString() } : c
          ),
        })),
      getPatientConsents: (patientId) => get().consentRecords.filter((c) => c.patient_id === patientId),

      addDsrRequest: (r) => {
        const record: DsrRequest = {
          ...r,
          id: generateId("dsr"),
          status: r.status ?? "ממתין",
          requested_at: new Date().toISOString(),
        };
        set((s) => ({ dsrRequests: [record, ...s.dsrRequests] }));
        return record;
      },
      updateDsrRequest: (id, data) =>
        set((s) => ({ dsrRequests: s.dsrRequests.map((r) => (r.id === id ? { ...r, ...data } : r)) })),

      exportPatientData: (patientId) => {
        const patient = get().patients.find((p) => p.id === patientId);
        if (!patient) return null;
        return {
          patient,
          appointments: get().appointments.filter((a) => a.created_by_id === patientId),
          orders: get().orders.filter((o) => o.created_by_id === patientId),
          consents: get().getPatientConsents(patientId),
          exported_at: new Date().toISOString(),
        };
      },
    }),
    {
      name: "healson-platform-store",
      version: 13,
      // The v1 -> v2 schema change (SKBH pricing, skill taxonomy, consent
      // records), the v2 -> v3 addition of the DEMO_NEW_PATIENT_USER seed
      // account, the v3 -> v4 AppointmentStatus rename ("ממתין לאישור" ->
      // "ממתין לתשלום מקדמה", "הושלם" -> "בוצע"), the v4 -> v5 admin-dashboard
      // additions (User.admin_title, Patient.processing_restricted,
      // commissionRateByServiceType, second seeded superadmin), the v5 -> v6
      // addition of the "שולם במלואו" AppointmentStatus and "extra"-service_type
      // catalog items (used by the new "שירותים נוספים" search tab), the
      // v6 -> v7 correction of K_LEVELS_BY_KUPAH plan names (stray whitespace
      // trimmed, so persisted kupah_arrangements referencing the old literal
      // strings would silently stop matching) are not backwards compatible
      // with anything persisted under an earlier version. From v7, two
      // branches of work bumped this independently and reused the same
      // v8/v9/v10 numbers for unrelated schema changes — provider
      // calendars-linked-to-services onboarding gating, visitRecords, demo
      // credential issuance, the consultations/exams catalog merge, the
      // provider-signup rework (immediate account+session instead of
      // waiting on Ops), and the skill-tree/global-catalog expansion on one
      // side; two published demo providers, Appointment.price/deposit
      // fields, and the documents tab on the other. v12 reconciles both
      // into one combined schema. v12 -> v13 backfills service_type and
      // linked_clinic_ids onto provider5/provider6's consultation_types —
      // without those, ProviderDiscovery's per-tab/specialty filtering
      // (which now reads services straight off each provider instead of a
      // shared reference catalog) could never surface those two doctors —
      // discard any state persisted under an earlier version so the app
      // reseeds clean instead of silently keeping stale seed/demo/status/
      // catalog data.
      migrate: (persistedState, version) => (version < 13 ? ({} as Store) : (persistedState as Store)),
      // Uploaded files (photos/PDFs) are stored as base64 data URLs inside
      // this same persisted blob (no real backend — see file.ts). If a
      // single write ever still exceeds the browser's localStorage quota
      // (e.g. many uploads accumulated over a long demo session), swallow
      // it here instead of letting it throw an unhandled rejection that
      // breaks every subsequent store write app-wide — the in-memory state
      // (and thus the current session) stays fully usable either way, it
      // just won't survive a refresh.
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (err) {
            console.warn(
              "[healson] localStorage quota exceeded — this change won't persist across page reloads.",
              err
            );
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
