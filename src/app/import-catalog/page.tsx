"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Upload, CheckCircle2, AlertTriangle, RefreshCw, FilePlus2 } from "lucide-react";
import { Select } from "@/components/ui/Input";
import {
  CATALOG_KIND_LABELS,
  CATALOG_KINDS,
  CatalogKind,
  PriceByLayer,
  SERVICE_TYPE_LABELS,
  ServiceType,
  SkillDomain,
  SkillSubdomain,
} from "@/types";

type ImportMode = "general" | "moh";

interface ParsedRow {
  name_he: string;
  tavar_code: string;
  domain_name: string;
  subdomain_name: string;
  service_type_label: string;
  base_price: number;
  // MoH price-list mode only — the official S and H tariffs per code.
  price_s?: number;
  price_h?: number;
  typical_duration_min: number | undefined;
  requires_referral: boolean;
  error?: string;
}

const SAMPLE_CSV = `name_he,tavar_code,domain_name,subdomain_name,service_type_label,base_price,typical_duration_min,requires_referral
ייעוץ אורתופדי - מרפק,HLS-20250,אורתופדיה,כתף,ייעוץ,420,30,לא
בדיקת CT - בטן,100051,גסטרואנטרולוגיה,קולונוסקופיה ומערכת העיכול,בדיקות,1100,45,כן
ייעוץ עיניים - רשתית,HLS-20251,רפואת עיניים,קטרקט ועדשות,ייעוץ,380,20,לא`;

// A realistic slice of the official MoH price list (מחירון מב"ר) — code,
// name, S and H tariffs. Re-importing the same codes UPDATES their prices.
const MOH_SAMPLE_CSV = `moh_code,name_he,domain_name,subdomain_name,service_type_label,price_s,price_h,typical_duration_min,requires_referral
54021,MRI עמוד שדרה מותני,אורתופדיה,כתף,בדיקות,390,1330,45,כן
54018,MRI ראש (מוח),אורתופדיה,כתף,בדיקות,420,1430,40,כן
93015,בדיקת מאמץ (ארגומטריה),קרדיולוגיה,קרדיולוגיה כללית,בדיקות,260,880,60,כן
29866,ארתרוסקופיה של הברך,אורתופדיה,ברך,ניתוחים,2450,8330,90,כן
45378,קולונוסקופיה אבחנתית,גסטרואנטרולוגיה,קולונוסקופיה ומערכת העיכול,בדיקות,780,2650,45,כן
76700,אולטרסאונד בטן מלא,גסטרואנטרולוגיה,קולונוסקופיה ומערכת העיכול,בדיקות,190,650,30,לא`;

function reverseServiceType(label: string): ServiceType | undefined {
  return (Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).find((key) => SERVICE_TYPE_LABELS[key] === label.trim());
}

function parseCsv(
  text: string,
  mode: ImportMode,
  skillDomains: SkillDomain[],
  skillSubdomains: SkillSubdomain[]
): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .filter((r) => r.trim())
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      let name_he: string,
        tavar_code: string,
        domain_name: string,
        subdomain_name: string,
        service_type_label: string,
        base_price: number,
        price_s: number | undefined,
        price_h: number | undefined,
        durationStr: string | undefined,
        referralStr: string | undefined;
      if (mode === "moh") {
        // moh_code,name_he,domain,subdomain,type,price_s,price_h,duration,referral
        let sStr: string, hStr: string;
        [tavar_code, name_he, domain_name, subdomain_name, service_type_label, sStr, hStr, durationStr, referralStr] = cells;
        price_s = Number(sStr);
        price_h = Number(hStr);
        base_price = price_s;
      } else {
        let priceStr: string;
        [name_he, tavar_code, domain_name, subdomain_name, service_type_label, priceStr, durationStr, referralStr] = cells;
        base_price = Number(priceStr);
      }
      const typical_duration_min = durationStr ? Number(durationStr) : undefined;
      const requires_referral = ["כן", "true", "1"].includes((referralStr ?? "").trim().toLowerCase());

      const domain = skillDomains.find((d) => d.name_he === domain_name);
      const subdomain = skillSubdomains.find((sd) => sd.name_he === subdomain_name && sd.domain_id === domain?.id);
      const serviceType = reverseServiceType(service_type_label ?? "");

      const error =
        !name_he
          ? "שם פריט חסר"
          : mode === "moh" && !tavar_code
          ? 'קוד מב"ר חסר'
          : mode === "moh" && (Number.isNaN(price_s!) || Number.isNaN(price_h!))
          ? "מחיר S/H לא תקין"
          : Number.isNaN(base_price)
          ? "מחיר לא תקין"
          : !domain
          ? `תחום "${domain_name}" לא קיים בטקסונומיה`
          : !subdomain
          ? `תת-תחום "${subdomain_name}" לא קיים תחת התחום`
          : !serviceType
          ? `סוג פריט "${service_type_label}" אינו מוכר`
          : undefined;

      return {
        name_he,
        tavar_code,
        domain_name,
        subdomain_name,
        service_type_label,
        base_price,
        price_s,
        price_h,
        typical_duration_min,
        requires_referral,
        error,
      };
    });
}

export default function ImportCatalogPage() {
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const catalog = useStore((s) => s.catalog);
  const bulkAddCatalogItems = useStore((s) => s.bulkAddCatalogItems);
  const importMohPriceList = useStore((s) => s.importMohPriceList);
  const showToast = useStore((s) => s.showToast);
  const [mode, setMode] = useState<ImportMode>("moh");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);
  // General mode: every row in one file lands in the same catalog.
  const [targetCatalog, setTargetCatalog] = useState<CatalogKind>("healson");

  // Existing מב"ר codes — used to preview which rows will be ADDED vs UPDATED.
  const existingMabarCodes = useMemo(
    () => new Set(catalog.filter((c) => c.catalog === "mabar" && c.tavar_code).map((c) => c.tavar_code!)),
    [catalog]
  );

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setRows(parseCsv(String(reader.result ?? ""), mode, skillDomains, skillSubdomains));
      setImported(false);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    setRows(parseCsv(mode === "moh" ? MOH_SAMPLE_CSV : SAMPLE_CSV, mode, skillDomains, skillSubdomains));
    setImported(false);
  }

  function switchMode(next: ImportMode) {
    setMode(next);
    setRows([]);
    setImported(false);
  }

  function confirmImport() {
    const valid = rows.filter((r) => !r.error);
    if (mode === "moh") {
      const { added, updated } = importMohPriceList(
        valid.map((r) => {
          const domain = skillDomains.find((d) => d.name_he === r.domain_name)!;
          const subdomain = skillSubdomains.find((sd) => sd.name_he === r.subdomain_name && sd.domain_id === domain.id)!;
          return {
            tavar_code: r.tavar_code,
            name_he: r.name_he,
            skill_domain_id: domain.id,
            skill_subdomain_id: subdomain.id,
            service_type: reverseServiceType(r.service_type_label)!,
            price_s: r.price_s!,
            price_h: r.price_h!,
            typical_duration_min: r.typical_duration_min,
            requires_referral: r.requires_referral,
          };
        })
      );
      showToast(`מחירון משרד הבריאות נטען: ${added} פריטים נוספו, ${updated} עודכנו`, { variant: "success" });
      setImported(true);
      return;
    }
    const count = bulkAddCatalogItems(
      valid.map((r) => {
        const domain = skillDomains.find((d) => d.name_he === r.domain_name)!;
        const subdomain = skillSubdomains.find((sd) => sd.name_he === r.subdomain_name && sd.domain_id === domain.id)!;
        // The CSV carries one headline price; the per-layer list is derived
        // the same way the seed does — מב"ר: S (=base) + H; הילסון: P (=base)
        // with S/H mirroring the MoH list and K/B as Healson tariffs.
        const layer_prices: PriceByLayer[] =
          targetCatalog === "mabar"
            ? [
                { layer: "S", price: r.base_price },
                { layer: "H", price: Math.round(r.base_price * 3.4) },
              ]
            : [
                { layer: "S", price: Math.round(r.base_price * 0.3) },
                { layer: "K", price: Math.round(r.base_price * 0.55) },
                { layer: "B", price: Math.round(r.base_price * 0.4) },
                { layer: "H", price: Math.round(r.base_price * 0.9) },
              ];
        return {
          name_he: r.name_he,
          tavar_code: r.tavar_code || undefined,
          catalog: targetCatalog,
          skill_domain_id: domain.id,
          skill_subdomain_id: subdomain.id,
          service_type: reverseServiceType(r.service_type_label)!,
          base_price: r.base_price,
          price_full: targetCatalog === "healson" ? r.base_price : undefined,
          layer_prices,
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
  const validRows = rows.filter((r) => !r.error);
  const mohAddCount = validRows.filter((r) => !existingMabarCodes.has(r.tavar_code)).length;
  const mohUpdateCount = validRows.length - mohAddCount;

  return (
    <AppLayout>
      <PageHeader
        title="ייבוא קטלוג"
        description='טעינת מחירון משרד הבריאות המלא לקטלוג מב"ר (עדכון מחירים לפי קוד), או ייבוא פריטים כללי'
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>מקור הייבוא</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select label="סוג ייבוא" value={mode} onChange={(e) => switchMode(e.target.value as ImportMode)} className="max-w-[280px]">
            <option value="moh">מחירון משרד הבריאות המלא (קטלוג מב״ר)</option>
            <option value="general">ייבוא פריטים כללי</option>
          </Select>
          {mode === "general" && (
            <Select
              label="קטלוג יעד"
              value={targetCatalog}
              onChange={(e) => setTargetCatalog(e.target.value as CatalogKind)}
              className="max-w-[220px]"
            >
              {CATALOG_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CATALOG_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
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
          <span className="basis-full text-xs text-slate-400">
            {mode === "moh"
              ? "עמודות: moh_code, name_he, domain_name, subdomain_name, service_type_label, price_s, price_h, typical_duration_min, requires_referral — קוד קיים יעודכן, קוד חדש יתווסף"
              : "עמודות: name_he, tavar_code, domain_name, subdomain_name, service_type_label, base_price, typical_duration_min, requires_referral"}
          </span>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="לא נבחר קובץ" description="העלה קובץ CSV או טען נתוני דוגמה כדי להתחיל" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>תצוגה מקדימה ({rows.length} שורות)</CardTitle>
            {mode === "moh" && (
              <p className="mt-1 flex items-center gap-3 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <FilePlus2 className="h-3.5 w-3.5 text-success" /> {mohAddCount} יתווספו
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5 text-info" /> {mohUpdateCount} יעודכנו (קוד קיים)
                </span>
              </p>
            )}
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
                  { key: "name", header: "שם פריט", render: (r) => r.name_he },
                  { key: "code", header: "קוד", render: (r) => <span className="text-slate-500">{r.tavar_code}</span> },
                  { key: "domain", header: "תחום", render: (r) => <span className="text-slate-500">{r.domain_name}</span> },
                  ...(mode === "moh"
                    ? ([
                        { key: "price_s", header: "מחיר S", render: (r) => <span className="text-slate-500">₪{r.price_s}</span> },
                        { key: "price_h", header: "מחיר H", render: (r) => <span className="text-slate-500">₪{r.price_h}</span> },
                        {
                          key: "op",
                          header: "פעולה",
                          render: (r) =>
                            r.error ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : existingMabarCodes.has(r.tavar_code) ? (
                              <Badge tone="blue">עדכון מחיר</Badge>
                            ) : (
                              <Badge tone="green">פריט חדש</Badge>
                            ),
                        },
                      ] satisfies DataTableColumn<ParsedRow & { _i: number }>[])
                    : ([
                        { key: "subdomain", header: "תת-תחום", render: (r) => <span className="text-slate-500">{r.subdomain_name}</span> },
                        { key: "price", header: "מחיר", render: (r) => <span className="text-slate-500">₪{r.base_price}</span> },
                      ] satisfies DataTableColumn<ParsedRow & { _i: number }>[])),
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
              <Button onClick={confirmImport} disabled={imported || validRows.length === 0}>
                {imported
                  ? "יובא בהצלחה"
                  : mode === "moh"
                  ? `טען מחירון (${mohAddCount} חדשים · ${mohUpdateCount} עדכונים)`
                  : `אישור ייבוא ${validRows.length} פריטים`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
