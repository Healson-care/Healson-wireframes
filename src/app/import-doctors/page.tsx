"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

interface ParsedRow {
  display_name: string;
  email: string;
  phone: string;
  specialty: string;
  license_number: string;
  error?: string;
}

const SAMPLE_CSV = `name,email,phone,specialty,license
ד"ר יעל ברק,yael.barak@example.co.il,050-1112222,אורתופדיה,MD-77001
ד"ר דני כהן,dani.cohen@example.co.il,050-3334444,קרדיולוגיה,MD-77002
ד"ר שרון לוי,sharon.levi@example.co.il,050-5556666,נוירולוגיה,`;

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .filter((r) => r.trim())
    .map((line) => {
      const [name, email, phone, specialty, license] = line.split(",").map((c) => c.trim());
      const error = !name ? "שם חובה" : !license ? "מספר רישיון חסר" : undefined;
      return {
        display_name: name ?? "",
        email: email ?? "",
        phone: phone ?? "",
        specialty: specialty ?? "",
        license_number: license ?? "",
        error,
      };
    });
}

export default function ImportDoctorsPage() {
  const bulkAddProviders = useStore((s) => s.bulkAddProviders);
  const showToast = useStore((s) => s.showToast);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setRows(parseCsv(String(reader.result ?? "")));
      setImported(false);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    setRows(parseCsv(SAMPLE_CSV));
    setImported(false);
  }

  function confirmImport() {
    const valid = rows.filter((r) => !r.error);
    const count = bulkAddProviders(
      valid.map((r) => ({
        display_name: r.display_name,
        specialty: r.specialty,
        license_number: r.license_number,
        is_published: false,
        is_active: true,
        consultation_types: [],
        exam_types: [],
        clinic_locations: [],
        referral_forms: [],
      }))
    );
    showToast(`יובאו ${count} ספקים בהצלחה`, { variant: "success" });
    setImported(true);
  }

  const errorCount = rows.filter((r) => r.error).length;

  return (
    <AppLayout>
      <PageHeader title="ייבוא ספקים" description="ייבוא נתוני ספקים בכמות מ-CSV" />

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
          <span className="text-xs text-slate-400">עמודות נדרשות: name, email, phone, specialty, license</span>
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
                  { key: "name", header: "שם", render: (r) => r.display_name },
                  { key: "email", header: "אימייל", render: (r) => <span className="text-slate-500">{r.email}</span> },
                  { key: "phone", header: "טלפון", render: (r) => <span className="text-slate-500">{r.phone}</span> },
                  { key: "specialty", header: "תחום", render: (r) => <span className="text-slate-500">{r.specialty}</span> },
                  { key: "license", header: "רישיון", render: (r) => <span className="text-slate-500">{r.license_number}</span> },
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
                {imported ? "יובא בהצלחה" : `אישור ייבוא ${rows.length - errorCount} ספקים`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
