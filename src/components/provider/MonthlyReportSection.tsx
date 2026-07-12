"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { BarChartSimple } from "@/components/charts/SimpleCharts";
import { formatCurrency, groupByMonth, downloadCsv } from "@/lib/utils";
import { Order } from "@/types";
import { Download, FileBarChart } from "lucide-react";

/** End-of-month financial report — the same component is used on the
 * provider dashboard ("דוחות" tab) and the admin provider-review dialog, so
 * both sides always see identical monthly figures for a given provider. */
export function MonthlyReportSection({
  orders,
  providerName,
  months = 6,
}: {
  orders: Order[];
  providerName?: string;
  months?: number;
}) {
  const completed = orders.filter((o) => o.status === "הושלם");
  const monthly = groupByMonth(completed, (o) => o.created_date, months).map((m) => {
    const revenue = m.items.reduce((sum, o) => sum + o.final_price, 0);
    const commission = m.items.reduce((sum, o) => sum + (o.commission_amount ?? 0), 0);
    const payout = m.items.reduce((sum, o) => sum + (o.provider_payout_amount ?? o.final_price), 0);
    return { key: m.key, label: m.label, orderCount: m.items.length, revenue, commission, payout };
  });

  const chartData = monthly.map((m) => ({ label: m.label.split(" ")[0], count: m.revenue }));
  const hasData = monthly.some((m) => m.orderCount > 0);

  function handleExport() {
    downloadCsv(
      `דוח-חודשי${providerName ? `-${providerName}` : ""}.csv`,
      ["חודש", "מס' עסקאות", "הכנסה ברוטו", "עמלת Healson", "תשלום נטו לספק"],
      monthly.map((m) => [m.label, m.orderCount, m.revenue, m.commission, m.payout])
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>דוח סוף חודש</CardTitle>
          <p className="text-sm text-slate-500">הכנסות, עמלות ותשלומים לפי חודש — {months} חודשים אחרונים</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!hasData}>
          <Download className="h-3.5 w-3.5" /> ייצוא CSV
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasData ? (
          <EmptyState icon={<FileBarChart className="h-10 w-10" />} title="אין עדיין עסקאות שהושלמו" />
        ) : (
          <>
            <BarChartSimple data={chartData} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="py-2 font-medium">חודש</th>
                    <th className="py-2 font-medium">עסקאות</th>
                    <th className="py-2 font-medium">הכנסה ברוטו</th>
                    <th className="py-2 font-medium">עמלת Healson</th>
                    <th className="py-2 font-medium">נטו לספק</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.key} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 font-medium text-slate-800">{m.label}</td>
                      <td className="py-2 text-slate-600">{m.orderCount}</td>
                      <td className="py-2 text-slate-900">{formatCurrency(m.revenue)}</td>
                      <td className="py-2 text-danger">{formatCurrency(m.commission)}</td>
                      <td className="py-2 font-semibold text-success">{formatCurrency(m.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
