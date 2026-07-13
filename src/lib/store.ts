import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Appointment,
  CatalogItem,
  ConsentRecord,
  ConsentType,
  CONSENT_DOCUMENT_VERSION,
  DoctorSubtype,
  DsrRequest,
  DsrRequestStatus,
  Kupah,
  KLevel,
  KupahArrangement,
  Lead,
  LabReferral,
  Order,
  Patient,
  ProviderProfile,
  ProviderType,
  Role,
  ServiceType,
  SkillDomain,
  SkillSubdomain,
  ToastItem,
  UploadedFile,
  User,
  WaitlistEntry,
} from "@/types";
import {
  DEMO_NEW_PATIENT_USER,
  SEED_APPOINTMENTS,
  SEED_BRANCHES,
  SEED_CATALOG,
  SEED_CONSENT_RECORDS,
  SEED_DSR_REQUESTS,
  SEED_LAB_REFERRALS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_PATIENTS,
  SEED_PROVIDERS,
  SEED_USERS,
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

interface PendingProviderApplication {
  provider_type: ProviderType;
  full_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  title?: string;
  specialty: string;
  license_number?: string;
  business_reg_number?: string;
  phone: string;
  email: string;
  license_file?: UploadedFile;
  doctor_subtype?: DoctorSubtype;
  surgical_board_certificate?: UploadedFile;
  malpractice_insurance_file?: UploadedFile;
  surgical_privileges_hospital?: string;
  description?: string;
  medical_resume_file?: UploadedFile;
  kupah_arrangements?: KupahArrangement[];
  private_insurance_companies?: string[];
  service_areas?: string[];
  sub_specialties?: string[];
  location_count?: number;
  member_provider_types?: ProviderType[];
  otp: string;
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
  pendingProviderApplication: PendingProviderApplication | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  loginWithGoogle: () => void;
  register: (email: string, password: string) => { ok: boolean; otpHint: string };
  verifyOtp: (email: string, code: string) => { ok: boolean; error?: string };
  resendOtp: () => string | null;
  applyAsProvider: (
    data: Omit<PendingProviderApplication, "otp">
  ) => { ok: boolean; error?: string; otpHint?: string };
  verifyProviderApplicationOtp: (code: string) => { ok: boolean; error?: string; providerId?: string };
  resendProviderApplicationOtp: () => string | null;
  forgotPassword: (email: string) => { ok: boolean };
  resetPassword: (newPassword: string) => { ok: boolean };
  logout: () => void;
  loginAsDemo: (role: Role, patientVariant?: "new" | "existing") => void;
  completePatientRegistration: (
    userId: string,
    data: { full_name: string; phone?: string; id_number: string; date_of_birth: string } & InsuranceProfileInput,
    consents: RegistrationConsents
  ) => Patient;
  quickRegisterPatient: (
    data: { full_name: string; phone: string; email: string; id_number: string; date_of_birth: string } & Partial<InsuranceProfileInput>,
    consents?: RegistrationConsents
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
  verifyProviderLicense: (id: string) => string;
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
      pendingProviderApplication: null,

      login: (email, password) => {
        if (!email || !password) return { ok: false, error: "נא להזין אימייל וסיסמה" };
        const existing = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          if (existing.role === "provider") {
            const provider = get().providers.find((p) => p.user_id === existing.id);
            if (provider?.status === "pending_review") {
              return { ok: false, error: "בקשת ההצטרפות שלך עדיין ממתינה לבדיקת רישיון. נעדכן אותך במייל בסיום הבדיקה." };
            }
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
        set({ currentUser: user });
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

      applyAsProvider: (data) => {
        const emailTaken = get().users.some((u) => u.email.toLowerCase() === data.email.toLowerCase());
        if (emailTaken) return { ok: false, error: "כתובת האימייל כבר רשומה במערכת" };
        const licenseTaken =
          !!data.license_number &&
          get().providers.some((p) => p.status !== "rejected" && p.license_number === data.license_number);
        if (licenseTaken) return { ok: false, error: "מספר הרישיון כבר רשום במערכת" };
        const otp = "123456";
        set({ pendingProviderApplication: { ...data, otp } });
        return { ok: true, otpHint: otp };
      },

      verifyProviderApplicationOtp: (code) => {
        const pending = get().pendingProviderApplication;
        if (!pending) return { ok: false, error: "לא נמצאה בקשת הצטרפות פעילה" };
        if (code !== pending.otp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        const newUser: User = {
          id: generateId("user"),
          email: pending.email,
          full_name: pending.full_name,
          role: "provider",
          phone: pending.phone,
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser], pendingProviderApplication: null }));
        const provider = get().upsertProviderProfile(newUser.id, {
          provider_type: pending.provider_type,
          display_name: pending.full_name,
          contact_name: pending.contact_name,
          contact_phone: pending.contact_phone,
          contact_email: pending.contact_email,
          title: pending.title,
          specialty: pending.specialty,
          license_number: pending.license_number,
          business_reg_number: pending.business_reg_number,
          license_file: pending.license_file,
          doctor_subtype: pending.doctor_subtype,
          surgical_board_certificate: pending.surgical_board_certificate,
          malpractice_insurance_file: pending.malpractice_insurance_file,
          surgical_privileges_hospital: pending.surgical_privileges_hospital,
          bio: pending.description,
          medical_resume_file: pending.medical_resume_file,
          kupah_arrangements: pending.kupah_arrangements,
          private_insurance_companies: pending.private_insurance_companies,
          service_areas: pending.service_areas,
          sub_specialties: pending.sub_specialties,
          location_count: pending.location_count,
          member_provider_types: pending.member_provider_types,
          phone_verified_at: new Date().toISOString(),
          status: "pending_review",
        });
        // No token/session is issued at this stage (PROV-APPLICATION) — the
        // applicant only gets full login access once Ops verifies the license.
        return { ok: true, providerId: provider.id };
      },

      resendProviderApplicationOtp: () => {
        const pending = get().pendingProviderApplication;
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
          date_of_birth: data.date_of_birth,
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

      quickRegisterPatient: (data, consents) => {
        const existingPatient = get().patients.find(
          (p) => p.email && p.email.toLowerCase() === data.email.toLowerCase()
        );
        if (existingPatient) {
          const existingUser = get().users.find((u) => u.id === existingPatient.user_id);
          if (existingUser) set({ currentUser: existingUser });
          if (data.kupah) {
            get().updatePatient(existingPatient.id, {
              id_number: data.id_number,
              date_of_birth: data.date_of_birth,
              kupah: data.kupah,
              k_level: data.k_level,
              has_b_insurance: data.has_b_insurance,
              b_insurance_company: data.b_insurance_company,
              b_policy_number: data.b_policy_number,
              address: data.address,
            });
          }
          if (consents) {
            (Object.keys(consents) as ConsentType[]).forEach((type) => {
              if (consents[type]) get().grantConsent(existingPatient.id, type, CONSENT_DOCUMENT_VERSION);
            });
          }
          return existingPatient;
        }
        const newUser: User = {
          id: generateId("user"),
          email: data.email,
          full_name: data.full_name,
          role: "patient",
          phone: data.phone,
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser], currentUser: newUser }));
        const patient = get().addPatient({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          id_number: data.id_number,
          date_of_birth: data.date_of_birth,
          kupah: data.kupah ?? "כללית",
          k_level: data.k_level,
          has_b_insurance: data.has_b_insurance,
          b_insurance_company: data.b_insurance_company,
          b_policy_number: data.b_policy_number,
          address: data.address,
          status: "פעיל",
          user_id: newUser.id,
        });
        if (consents) {
          (Object.keys(consents) as ConsentType[]).forEach((type) => {
            if (consents[type]) get().grantConsent(patient.id, type, CONSENT_DOCUMENT_VERSION);
          });
        }
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
            // Onboarding readiness (FEAT-06) is derived, not set by any single
            // screen — recompute it here so every write path (agreements,
            // catalog, sign) stays in sync automatically.
            if (
              updated.status === "onboarding" &&
              !updated.onboarding_ready_at &&
              updated.agreements.length > 0 &&
              (updated.consultation_types.length > 0 || updated.exam_types.length > 0) &&
              updated.agreement_signed_at
            ) {
              updated.onboarding_ready_at = new Date().toISOString();
            }
            return updated;
          }),
        })),

      verifyProviderLicense: (id) => {
        // Mock credential issuance: the applicant never set a password at
        // application time (PROV-APPLICATION §out-of-scope) — a temporary
        // one is "sent" to them once Ops verifies the license and opens
        // onboarding access. Login itself never actually checks the
        // password (see login(), matching the rest of this mock app).
        const tempPassword = Math.random().toString(36).slice(-8);
        get().updateProviderById(id, { status: "onboarding", license_verified_at: new Date().toISOString() });
        return tempPassword;
      },
      // Demo shortcut (product-demo flow) — skips the real Ops license-review
      // + Go-Live pipeline entirely: the applicant is dropped straight into
      // their own /provider/dashboard to self-serve the rest of the setup
      // (catalog/locations/availability) and gets logged in immediately,
      // since normally no session is issued until Ops verifies the license.
      demoApproveProvider: (id) => {
        const provider = get().providers.find((p) => p.id === id);
        get().updateProviderById(id, {
          status: "approved",
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
      version: 8,
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
      // strings would silently stop matching), and the v7 -> v8 addition of
      // Appointment.price/deposit_amount/deposit_paid_at (cancellation-refund
      // policy) plus renamed seed clinic names are not backwards compatible
      // with anything persisted under an earlier version — discard old state
      // on a version bump so the app reseeds clean instead of silently
      // keeping stale seed/demo/status/catalog data.
      migrate: (persistedState, version) => (version < 8 ? ({} as Store) : (persistedState as Store)),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
