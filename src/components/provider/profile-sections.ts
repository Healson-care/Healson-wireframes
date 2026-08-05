// Single source of truth for the provider PROFILE section — the dedicated
// configuration pages that live behind the "פרופיל" dropdown in the top nav
// (and are surfaced as cards on the profile overview hub). Kept type-aware so a
// store/pharmacy doesn't advertise agreements or availability it never uses.
//
// ORDER IS THE PRODUCT, not an accident. For a medical unit the list follows
// the order the unit actually builds itself in — you cannot place an עמדה
// before there is a מערך to put it in, nor a מערך before a סניף:
//
//     סניפים → מערכים → זמינות (עמדות ולוחות זמנים) → פריטים → נותני שירות
//
// then everything administrative. Two entries were deliberately removed:
//   • "מכשירים" — equipment is no longer a top-level concept. A machine is an
//     עמדה, and עמדות are managed inside their מערך (see the מערכים page).
//   • "פרטי היחידה" — a unit has exactly one address, which is identity, not
//     configuration. It moved onto the סקירה page.
import {
  LayoutDashboard,
  Stethoscope,
  Handshake,
  MapPin,
  MapPinned,
  Layers,
  CalendarClock,
  CreditCard,
  FileBarChart,
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
  // Medical units get the branch → מערך → עמדה structure; everyone else keeps
  // the flat "מרפאות / סניפים" location list they always had.
  const isUnit = !!setupConfig.showFacilities;

  const structureSections: ProfileSection[] = isUnit
    ? [
        {
          key: "branches",
          href: "/provider/profile/structure",
          label: "סניפים",
          icon: MapPinned,
          description: "האתרים הפיזיים של היחידה — כתובת, פרטי קשר והמערכים שבכל אחד",
        },
        {
          key: "arrays",
          href: "/provider/profile/arrays",
          label: "מערכים",
          icon: Layers,
          description: "קווי השירות של היחידה (הדמיה, ייעוצים, בדיקות…), העמדות שבכל מערך ושיוכם לסניפים",
        },
      ]
    : [
        {
          key: "clinics",
          href: "/provider/profile/clinics",
          label: setupConfig.locationLabelPlural,
          icon: MapPin,
          description: `ניהול ה${setupConfig.locationLabelPlural} והפריטים המקושרים אליהם`,
        },
      ];

  return [
    {
      key: "overview",
      href: "/provider/profile",
      label: "סקירה",
      icon: LayoutDashboard,
      description: isUnit
        ? "תמצית הפרופיל, פרטי היחידה וסטטוס השלמת ההגדרות"
        : "תמצית הפרופיל, סטטוס האימות והשלמת ההגדרות",
    },
    ...structureSections,
    ...(setupConfig.showAvailability
      ? [
          {
            key: "availability",
            href: "/provider/profile/availability",
            label: "זמינות",
            icon: CalendarClock,
            description: isUnit
              ? "יומן היחידה, לוחות הזמנים של כל עמדה ולו״זים משותפים"
              : "משמרות, הפסקות, חריגות ותאריכים חסומים",
          },
        ]
      : []),
    {
      key: "services",
      href: "/provider/profile/services",
      label: setupConfig.catalogLabel,
      icon: Stethoscope,
      description: `ניהול ${setupConfig.catalogLabel} והמחירים לכל שכבת ביטוח`,
    },
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
    // --- administrative tail ---
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
      key: "payments",
      href: "/provider/profile/payments",
      label: "תשלומים",
      icon: CreditCard,
      description: "הכנסות, תשלום לספק ופרטי חשבון בנק",
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
