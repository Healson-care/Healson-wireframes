// Single source of truth for the provider PROFILE section — the dedicated
// configuration pages that live behind the "פרופיל" dropdown in the top nav
// (and are surfaced as cards on the profile overview hub). Kept type-aware so a
// store/pharmacy doesn't advertise agreements or availability it never uses,
// mirroring the old dashboard tabs' conditional logic.
import {
  LayoutDashboard,
  Stethoscope,
  Handshake,
  MapPin,
  CalendarClock,
  CreditCard,
  FileBarChart,
  MonitorCog,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ProviderTypeSetupConfig } from "@/lib/provider-setup";

export interface ProfileSection {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export function getProfileSections(setupConfig: ProviderTypeSetupConfig): ProfileSection[] {
  return [
    {
      key: "overview",
      href: "/provider/profile",
      label: "סקירה",
      icon: LayoutDashboard,
      description: "תמצית הפרופיל, סטטוס האימות והשלמת ההגדרות",
    },
    {
      key: "services",
      href: "/provider/profile/services",
      label: setupConfig.catalogLabel,
      icon: Stethoscope,
      description: `ניהול ${setupConfig.catalogLabel} והמחירים לכל שכבת ביטוח`,
    },
    ...(setupConfig.showAgreements
      ? [
          {
            key: "agreements",
            href: "/provider/profile/agreements",
            label: "הסדרים",
            icon: Handshake,
            description: "הסדרי ביטוח (S/K/B/H), קופות וחברות ביטוח פרטיות",
          },
        ]
      : []),
    {
      key: "clinics",
      href: "/provider/profile/clinics",
      label: setupConfig.locationLabelPlural,
      icon: MapPin,
      description: setupConfig.singleLocation
        ? "כתובת היחידה, פרטי התקשרות ופריטים — היחידה עצמה היא הסניף"
        : `ניהול ה${setupConfig.locationLabelPlural} והפריטים המקושרים אליהם`,
    },
    // Medical units (§PRV-08) — machines/rooms that hold their own queue.
    ...(setupConfig.showFacilities
      ? [
          {
            key: "facilities",
            href: "/provider/profile/facilities",
            label: "חדרים",
            icon: MonitorCog,
            description: "MRI, CT, חדרי פעולות — והפריטים המבוצעים בכל אחד",
          },
        ]
      : []),
    ...(setupConfig.showAvailability
      ? [
          {
            key: "availability",
            href: "/provider/profile/availability",
            label: "זמינות",
            icon: CalendarClock,
            description: setupConfig.showFacilities
              ? "זמינות כללית של היחידה, ולוח זמנים נפרד לכל חדר ולכל נותן/ת שירות"
              : "משמרות, הפסקות, חריגות ותאריכים חסומים",
          },
        ]
      : []),
    ...(setupConfig.showAffiliatedDoctors
      ? [
          {
            key: "doctors",
            href: "/provider/profile/doctors",
            label: "נותני שירות",
            icon: Stethoscope,
            description: "נותני השירות הפועלים בארגון והפריטים שכל אחד מבצע",
          },
        ]
      : []),
    {
      key: "payments",
      href: "/provider/profile/payments",
      label: "תשלומים",
      icon: CreditCard,
      description: "הכנסות, עמלות, תשלום נטו ופרטי חשבון בנק",
    },
    {
      key: "reports",
      href: "/provider/profile/reports",
      label: "דוחות",
      icon: FileBarChart,
      description: "התחשבנות חודשית ודוחות פעילות",
    },
    {
      key: "settings",
      href: "/provider/profile/settings",
      label: "הגדרות",
      icon: Settings,
      description: "פרטים אישיים ומקצועיים ותבניות הפניה",
    },
  ];
}
