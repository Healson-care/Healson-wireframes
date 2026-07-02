"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { KUPOT } from "@/types";

interface ParsedRow {
  item_name: string;
  item_code: string;
  domain: string;
  sub_domain: string;
  staff_name: string;
  prices: number[];
  error?: string;
}

const SAMPLE_CSV = `item_name,item_code,domain,sub_domain,staff_name,kupah_1_price,kupah_2_price,kupah_3_price,kupah_4_price
ייעוץ אורתופדי - מרפק,CAT-9001,אורתופדיה,מרפק,ד"ר אבי לוי,420,400,410,430
בדיקת CT - בטן,CAT-9002,גסטרואנטרולוגיה,קולונוסקופיה ומערכת העיכול,ד"ר מיכל ברק,1100,1050,1080,1120
ייעוץ עיניים - רשתית,CAT-9003,רפואת עיניים,קטרקט ועדשות,,380,360,,400`;

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .filter((r) => r.trim())
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const [item_name, item_code, domain, sub_domain, staff_name, p1, p2, p3, p4] = cells;
      const prices = [p1, p2, p3, p4].map((p) => Number(p));
      const error =
        !item_name || !item_code
          ? "שם או קוד פריט חסר"
          : prices.some((p) => Number.isNaN(p))
          ? "מחיר לא תקין"
          : undefined;
      return { item_name, item_code, domain, sub_domain, staff_name, prices, error };
    });
}

export default function ImportCatalogPage() {
  const bulkAddCatalogItems = useStore((s) => s.bulkAddCatalogItems);
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
    const count = bulkAddCatalogItems(
      valid.map((r) => ({
        item_name: r.item_name,
        item_code: r.item_code,
        domain: r.domain,
        sub_domain: r.sub_domain,
        service_type: "ייעוץ",
        staff_name: r.staff_name || undefined,
        is_active: true,
        price_K: KUPOT.map((k, i) => ({ kupah: k, price: r.prices[i] || 0 })),
      }))
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
            עמודות: item_name, item_code, domain, sub_domain, staff_name, kupah_1..4_price
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
                  { key: "name", header: "שם פריט", render: (r) => r.item_name },
                  { key: "code", header: "קוד", render: (r) => <span className="text-slate-500">{r.item_code}</span> },
                  { key: "domain", header: "תחום", render: (r) => <span className="text-slate-500">{r.domain}</span> },
                  { key: "subdomain", header: "תת-תחום", render: (r) => <span className="text-slate-500">{r.sub_domain}</span> },
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
