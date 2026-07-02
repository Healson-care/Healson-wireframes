// Core domain types for the HealthBridge / HEALSON mock platform.
// NOTE: This is a fully local, mock-data-driven app. No backend/API calls are made.

export type Role = "admin" | "provider" | "patient";

export type Kupah = "כללית" | "מכבי" | "מאוחדת" | "לאומית";

export const KUPOT: Kupah[] = ["כללית", "מכבי", "מאוחדת", "לאומית"];

export type AppointmentStatus = "ממתין לאישור" | "מאושר" | "הושלם" | "בוטל";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "ממתין לאישור",
  "מאושר",
  "הושלם",
  "בוטל",
];

export type PatientStatus = "פעיל" | "לא פעיל" | "ממתין";
export const PATIENT_STATUSES: PatientStatus[] = ["פעיל", "לא פעיל", "ממתין"];

export type LeadStatus = "חדש" | "נוצר קשר" | "מתוכנן" | "הומר" | "לא מעוניין";
export const LEAD_STATUSES: LeadStatus[] = [
  "חדש",
  "נוצר קשר",
  "מתוכנן",
  "הומר",
  "לא מעוניין",
];

export type OrderStatus = "ממתין" | "מאושר" | "בביצוע" | "הושלם" | "בוטל";
export const ORDER_STATUSES: OrderStatus[] = [
  "ממתין",
  "מאושר",
  "בביצוע",
  "הושלם",
  "בוטל",
];

export type ReferralStatus = "ממתין לעיבוד" | "בעיבוד" | "הושלם" | "שגיאה";
export const REFERRAL_STATUSES: ReferralStatus[] = [
  "ממתין לעיבוד",
  "בעיבוד",
  "הושלם",
  "שגיאה",
];

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  created_date: string;
}

export interface PriceByKupah {
  kupah: Kupah;
  price: number;
  discount?: number;
}

export interface Patient {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  id_number?: string;
  parent_name?: string;
  kupah: Kupah;
  status: PatientStatus;
  assigned_provider?: string; // ProviderProfile id
  created_date: string;
  user_id?: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  source: string;
  notes?: string;
  status: LeadStatus;
  last_contact?: string;
  conversion_date?: string;
  created_date: string;
}

export type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type ClinicHours = Record<DayKey, [string, string] | null>;

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  is_primary: boolean;
  hours: ClinicHours;
}

export interface ConsultationType {
  id: string;
  name: string;
  duration_minutes: number;
  prices: PriceByKupah[];
}

export interface ExamType {
  id: string;
  name: string;
  lab_code: string;
  prices: PriceByKupah[];
}

export interface ReferralFormField {
  id: string;
  name: string;
  type: "text" | "textarea" | "date" | "number";
  required: boolean;
}

export interface ReferralFormTemplate {
  id: string;
  name: string;
  fields: ReferralFormField[];
}

export interface ProviderProfile {
  id: string;
  user_id?: string;
  display_name: string;
  title?: string;
  specialty: string;
  bio?: string;
  languages?: string[];
  rating?: number;
  review_count?: number;
  license_number?: string;
  license_issuer?: string;
  license_issue_date?: string;
  license_expiry_date?: string;
  image_url?: string;
  is_published: boolean;
  is_active: boolean;
  consultation_types: ConsultationType[];
  exam_types: ExamType[];
  clinic_locations: Clinic[];
  referral_forms: ReferralFormTemplate[];
  created_date: string;
}

export interface CatalogItem {
  id: string;
  item_name: string;
  item_code: string;
  domain: string;
  sub_domain: string;
  service_type: string;
  staff_name?: string;
  is_active: boolean;
  price_K: PriceByKupah[];
}

export interface Appointment {
  id: string;
  client_name: string;
  client_phone?: string;
  provider_id?: string;
  provider_name: string;
  service_name: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration_minutes: number;
  status: AppointmentStatus;
  kupah?: Kupah;
  notes?: string;
  created_by_id?: string; // patient id
}

export interface Order {
  id: string;
  item_id?: string;
  item_name: string;
  provider_id?: string;
  provider_name: string;
  created_by_id?: string;
  patient_name: string;
  final_price: number;
  status: OrderStatus;
  created_date: string;
}

export interface LabReferral {
  id: string;
  provider_id?: string;
  provider_name: string;
  patient_id?: string;
  patient_name: string;
  test_types: string[];
  lab_code?: string;
  status: ReferralStatus;
  created_date: string;
  completed_date?: string;
  notes?: string;
  results?: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}
