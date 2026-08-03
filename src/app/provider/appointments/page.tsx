"use client";

import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { isUnitProvider } from "@/lib/unit-resources";
import { ProviderAppointmentCalendar } from "@/components/provider/schedule/ProviderAppointmentCalendar";

export default function ProviderAppointmentsPage() {
  const provider = useCurrentProvider();
  // Stay inside the layout while the profile resolves, so its role guard and
  // stage redirects keep running instead of a bare skeleton with no shell.
  const isUnit = provider ? isUnitProvider(provider) : false;

  return (
    <ProviderLayout>
      {provider ? (
        <>
          <PageHeader
            title="ניהול יומן"
            description={
              isUnit
                ? "היומן התפעולי של היחידה — בתצוגת יום כל עמדה מקבלת עמודה משלה. גררו תור כדי לשנות שעה או להעביר לעמדה אחרת, ולחצו עליו כדי לפתוח את תיק המטופל."
                : "היומן המאוחד שלך — בתצוגת יום כל מרפאה שלך וכל יחידה שאתם עובדים מולה מקבלת עמודה משלה, כך שברור מה שלכם ומה שובץ על ידי היחידה. גררו תור כדי לשנות שעה, תאריך או מרפאה, ולחצו עליו כדי לפתוח את תיק המטופל."
            }
          />
          <ProviderAppointmentCalendar provider={provider} />
        </>
      ) : (
        <DashboardSkeleton />
      )}
    </ProviderLayout>
  );
}
