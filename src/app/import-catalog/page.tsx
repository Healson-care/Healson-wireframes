"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { SERVICE_TYPE_LABELS, ServiceType, SkillDomain, SkillSubdomain } from "@/types";

interface ParsedRow {
  name_he: string;
  tavar_code: string;
  domain_name: string;
  subdomain_name: string;
  service_type_label: string;
  base_price: number;
  typical_duration_min: number | undefined;
  requires_referral: boolean;
  error?: string;
}

const SAMPLE_CSV = `name_he,tavar_code,domain_name,subdomain_name,service_type_label,base_price,typical_duration_min,requires_referral
ייעוץ אורתופדי - מרפק,100050,אורתופדיה,כתף,ייעוץ,420,30,לא
בדיקת CT - בטן,100051,גסטרואנטרולוגיה,קולונוסקופיה ומערכת העיכול,בדיקות,1100,45,כן
ייעוץ עיניים - רשתית,100052,רפואת עיניים,קטרקט ועדשות,ייעוץ,380,20,לא`;

function reverseServiceType(label: string): ServiceType | undefined {
  return (Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).find((key) => SERVICE_TYPE_LABELS[key] === label.trim());
}

function parseCsv(text: string, skillDomains: SkillDomain[], skillSubdomains: SkillSubdomain[]): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .filter((r) => r.trim())
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const [name_he, tavar_code, domain_name, subdomain_name, service_type_label, priceStr, durationStr, referralStr] = cells;
      const base_price = Number(priceStr);
      const typical_duration_min = durationStr ? Number(durationStr) : undefined;
      const requires_referral = ["כן", "true", "1"].includes((referralStr ?? "").trim().toLowerCase());

      const domain = skillDomains.find((d) => d.name_he === domain_name);
      const subdomain = skillSubdomains.find((sd) => sd.name_he === subdomain_name && sd.domain_id === domain?.id);
      const serviceType = reverseServiceType(service_type_label ?? "");

      const error =
        !name_he
          ? "שם שירות חסר"
          : Number.isNaN(base_price)
          ? "מחיר תב״ר לא תקין"
          : !domain
          ? `תחום "${domain_name}" לא קיים בטקסונומיה`
          : !subdomain
          ? `תת-תחום "${subdomain_name}" לא קיים תחת התחום`
          : !serviceType
          ? `סוג שירות "${service_type_label}" אינו מוכר`
          : undefined;

      return {
        name_he,
        tavar_code,
        domain_name,
        subdomain_name,
        service_type_label,
        base_price,
        typical_duration_min,
        requires_referral,
        error,
      };
    });
}

export default function ImportCatalogPage() {
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const bulkAddCatalogItems = useStore((s) => s.bulkAddCatalogItems);
  const showToast = useStore((s) => s.showToast);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setRows(parseCsv(String(reader.result ?? ""), skillDomains, skillSubdomains));
      setImported(false);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    setRows(parseCsv(SAMPLE_CSV, skillDomains, skillSubdomains));
    setImported(false);
  }

  function confirmImport() {
    const valid = rows.filter((r) => !r.error);
    const count = bulkAddCatalogItems(
      valid.map((r) => {
        const domain = skillDomains.find((d) => d.name_he === r.domain_name)!;
        const subdomain = skillSubdomains.find((sd) => sd.name_he === r.subdomain_name && sd.domain_id === domain.id)!;
        return {
          name_he: r.name_he,
          tavar_code: r.tavar_code || undefined,
          skill_domain_id: domain.id,
          skill_subdomain_id: subdomain.id,
          service_type: reverseServiceType(r.service_type_label)!,
          base_price: r.base_price,
          typical_duration_min: r.typical_duration_min,
          requires_referral: r.requires_referral,
          is_active: true,
        };
      })
    );
    showToast(`יובאו ${count} פריטי קטלוג בהצלחה`, { variant: "success" });
    setImported(true);
  }

  const errorCount = rows.filter((r) => r.error).length;

  return (
    <AppLayout>
      <PageHeader title="ייבוא קטלוג" description="ייבוא פריטי שירות בכמות מ-CSV" />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>העלאת קובץ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:border-primary">
            <Upload className="h-4 w-4" />
            בחר קובץ CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          <Button variant="outline" size="sm" onClick={loadSample}>
            טען נתוני דוגמה
          </Button>
          <span className="text-xs text-slate-400">
            עמודות: name_he, tavar_code, domain_name, subdomain_name, service_type_label, base_price, typical_duration_min, requires_referral
          </span>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="לא נבחר קובץ" description="העלה קובץ CSV או טען נתוני דוגמה כדי להתחיל" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>תצוגה מקדימה ({rows.length} שורות)</CardTitle>
            {errorCount > 0 && (
              <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {errorCount} שורות עם שגיאות יידלגו
              </p>
            )}
          </CardHeader>
          <CardContent>
            <DataTable<ParsedRow & { _i: number }>
              rows={rows.map((r, i) => ({ ...r, _i: i }))}
              rowKey={(r) => String(r._i)}
              emptyTitle="אין שורות"
              columns={
                [
                  { key: "name", header: "שם שירות", render: (r) => r.name_he },
                  { key: "code", header: "תב״ר", render: (r) => <span className="text-slate-500">{r.tavar_code}</span> },
                  { key: "domain", header: "תחום", render: (r) => <span className="text-slate-500">{r.domain_name}</span> },
                  { key: "subdomain", header: "תת-תחום", render: (r) => <span className="text-slate-500">{r.subdomain_name}</span> },
                  { key: "price", header: "מחיר", render: (r) => <span className="text-slate-500">₪{r.base_price}</span> },
                  {
                    key: "status",
                    header: "סטטוס",
                    render: (r) =>
                      r.error ? (
                        <span className="text-danger-text text-xs">{r.error}</span>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ),
                  },
                ] satisfies DataTableColumn<ParsedRow & { _i: number }>[]
              }
            />
            <div className="flex justify-end mt-4">
              <Button onClick={confirmImport} disabled={imported}>
                {imported ? "יובא בהצלחה" : `אישור ייבוא ${rows.length - errorCount} פריטים`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
