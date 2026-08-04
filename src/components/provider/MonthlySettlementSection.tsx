"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { fileToDataUrl } from "@/lib/file";
import { formatCurrency, formatDateHe, groupByMonth } from "@/lib/utils";
import { MonthlySettlement, Order, ToastItem, UploadedFile } from "@/types";
import { CheckCircle2, FileWarning, Handshake, Upload } from "lucide-react";

/** Monthly reconciliation flow (automation §"התחשבנות חודשית" in the journey
 * map): for every closed month with activity the provider reviews the derived
 * figures, approves the report or disputes it with a note, and uploads their
 * invoice. The payout column derives the transfer schedule — payouts go out
 * on the 15th of the following month, only after the report is approved and
 * an invoice is on file. */
export function MonthlySettlementSection({
  orders,
  settlements,
  onChange,
  showToast,
  months = 6,
}: {
  orders: Order[];
  settlements: MonthlySettlement[];
  onChange: (settlements: MonthlySettlement[]) => void;
  showToast: (title: string, opts?: { description?: string; variant?: ToastItem["variant"] }) => void;
  months?: number;
}) {
  const [disputeMonth, setDisputeMonth] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  // Snapshot "now" once per mount — keeps render pure (react-hooks/purity)
  // while still letting the payout column compare against the current date.
  const [now] = useState(() => Date.now());

  const currentMonthKey = new Date(now).toISOString().slice(0, 7);
  const completed = orders.filter((o) => o.status === "הושלם");
  // Reconciliation applies to closed months only — the running month is
  // still accumulating activity and can't be approved yet.
  const rows = groupByMonth(completed, (o) => o.created_date, months)
    .filter((m) => m.key < currentMonthKey && m.items.length > 0)
    .reverse()
    .map((m) => {
      const collected = m.items.filter((o) => o.payment_status === "שולם במלואו");
      const gross = m.items.reduce((sum, o) => sum + o.final_price, 0);
      const payout = collected.reduce((sum, o) => sum + (o.provider_payout_amount ?? o.final_price), 0);
      const settlement = settlements.find((s) => s.month === m.key);
      // Payout is transferred on the 15th of the month following the
      // reconciled month.
      const [y, mo] = m.key.split("-").map(Number);
      const payoutDate = new Date(y, mo, 15);
      return { key: m.key, label: m.label, count: m.items.length, gross, payout, settlement, payoutDate };
    });

  function upsertSettlement(month: string, patch: Partial<MonthlySettlement>) {
    const existing = settlements.find((s) => s.month === month);
    const next: MonthlySettlement = { month, status: "ממתין לאישור", ...existing, ...patch };
    onChange(existing ? settlements.map((s) => (s.month === month ? next : s)) : [...settlements, next]);
  }

  async function handleInvoiceUpload(month: string, file: File | undefined) {
    if (!file) return;
    try {
      const record: UploadedFile = {
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        data_url: await fileToDataUrl(file),
      };
      upsertSettlement(month, { invoice_file: record });
      showToast("החשבונית הועלתה בהצלחה", { variant: "success" });
    } catch (err) {
      showToast("שגיאה בהעלאת הקובץ", {
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-slate-400" /> התחשבנות חודשית
        </CardTitle>
        <p className="text-sm text-slate-500">
          אישור דוח הפעילות לכל חודש שנסגר, העלאת חשבונית ומעקב אחר העברת התשלום (מבוצעת ב-15 לחודש העוקב)
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-10 w-10" />}
            title="אין עדיין חודשים להתחשבנות"
            description="ברגע שיירשמו עסקאות שהושלמו בחודש שנסגר, הדוח החודשי יופיע כאן לאישור."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => {
              const status = row.settlement?.status ?? "ממתין לאישור";
              const hasInvoice = !!row.settlement?.invoice_file;
              const payoutDue = row.payoutDate.getTime() <= now;
              const transferred = status === "אושר" && hasInvoice && payoutDue;
              return (
                <div key={row.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      {status === "אושר" ? (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" /> אושר
                        </Badge>
                      ) : status === "במחלוקת" ? (
                        <Badge tone="danger">
                          <FileWarning className="h-3 w-3" /> במחלוקת
                        </Badge>
                      ) : (
                        <Badge tone="warning">ממתין לאישור שלך</Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      {transferred ? (
                        <span className="font-medium text-success-text">
                          התשלום הועבר ב-{formatDateHe(row.payoutDate.toISOString())}
                        </span>
                      ) : status === "במחלוקת" ? (
                        <span className="font-medium text-danger-text">התשלום מוקפא עד לפתרון הפער</span>
                      ) : status === "אושר" && !hasInvoice ? (
                        <span className="font-medium text-warning-text">נדרשת חשבונית לפני העברת התשלום</span>
                      ) : status === "אושר" ? (
                        <span className="font-medium text-info-text">
                          העברה צפויה ב-{formatDateHe(row.payoutDate.toISOString())}
                        </span>
                      ) : (
                        <span className="text-slate-500">התשלום יתוזמן לאחר אישור הדוח</span>
                      )}
                    </div>
                  </div>

                  {/* Healson's commission is deliberately absent: the provider
                      reconciles what they are owed, not what the platform kept. */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">עסקאות</p>
                      <p className="font-medium text-slate-900 tabular-nums">{row.count}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">הכנסה ברוטו</p>
                      <p className="font-medium text-slate-900 tabular-nums">{formatCurrency(row.gross)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">לתשלום לספק</p>
                      <p className="font-semibold text-success tabular-nums">{formatCurrency(row.payout)}</p>
                    </div>
                  </div>

                  {row.settlement?.dispute_note && status === "במחלוקת" && (
                    <p className="mt-2 rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger-text">
                      הפער שדווח: {row.settlement.dispute_note}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {status !== "אושר" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          upsertSettlement(row.key, {
                            status: "אושר",
                            approved_at: new Date().toISOString(),
                            dispute_note: undefined,
                          });
                          showToast("דוח החודש אושר", { variant: "success" });
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> אישור הדוח
                      </Button>
                    )}
                    {status !== "במחלוקת" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDisputeMonth(row.key);
                          setDisputeNote(row.settlement?.dispute_note ?? "");
                        }}
                      >
                        <FileWarning className="h-3.5 w-3.5" /> דיווח על פער
                      </Button>
                    )}
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-primary hover:bg-primary/5">
                      <Upload className="h-3.5 w-3.5" />
                      <span className="max-w-[180px] truncate">
                        {row.settlement?.invoice_file ? row.settlement.invoice_file.file_name : "העלאת חשבונית"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => handleInvoiceUpload(row.key, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={!!disputeMonth}
        onClose={() => setDisputeMonth(null)}
        title="דיווח על פער בדוח החודשי"
        description="פרטו את הפער — צוות Healson יבדוק מולכם ויפיק דוח מתוקן. התשלום לחודש זה יוקפא עד לפתרון."
      >
        <div className="flex flex-col gap-3">
          <Textarea
            label="מה הפער שמצאתם?"
            value={disputeNote}
            onChange={(e) => setDisputeNote(e.target.value)}
            required
          />
          <Button
            disabled={disputeNote.trim().length < 5}
            title={disputeNote.trim().length < 5 ? "יש לפרט את הפער (לפחות 5 תווים)" : undefined}
            onClick={() => {
              if (disputeMonth) {
                upsertSettlement(disputeMonth, {
                  status: "במחלוקת",
                  dispute_note: disputeNote.trim(),
                  approved_at: undefined,
                });
                showToast("הפער דווח לצוות Healson", { variant: "success" });
              }
              setDisputeMonth(null);
              setDisputeNote("");
            }}
          >
            שליחת דיווח
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
