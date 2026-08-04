"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, StatCard } from "@/components/ui/Misc";
import { BarChartSimple } from "@/components/charts/SimpleCharts";
import { BankAccountSection } from "@/components/provider/BankAccountSection";
import { BalanceCollectionSection } from "@/components/provider/BalanceCollectionSection";
import { formatCurrency, buildMonthlyData } from "@/lib/utils";
import { isUnitProvider } from "@/lib/unit-resources";

export default function ProviderPaymentsPage() {
  const orders = useStore((s) => s.orders);
  return (
    <ProfilePageFrame title="תשלומים והתחשבנות" description="הכנסות, תשלום לספק ופרטי חשבון בנק">
      {({ provider, update, showToast }) => {
        const myOrders = orders.filter((o) => o.provider_id === provider.id);
        const completedOrders = myOrders.filter((o) => o.status === "הושלם");
        const completedRevenue = completedOrders.reduce((sum, o) => sum + o.final_price, 0);
        // Net payout only counts fully-collected orders — a completed service
        // whose balance is still a deposit isn't payable yet.
        const collectedOrders = completedOrders.filter((o) => o.payment_status === "שולם במלואו");
        const netPayout = collectedOrders.reduce((sum, o) => sum + (o.provider_payout_amount ?? o.final_price), 0);
        const pendingCollectionPayout = completedOrders
          .filter((o) => o.payment_status !== "שולם במלואו" && o.payment_status !== "הוחזר")
          .reduce((sum, o) => sum + (o.provider_payout_amount ?? 0), 0);
        const revenueMonthly = buildMonthlyData(completedOrders, (o) => o.created_date, 6, (o) => o.final_price);

        return (
          <div className="flex flex-col gap-4">
            {/* Bank account first — it's the actionable setup step and was easy
                to miss buried under the stats/transactions. */}
            <BankAccountSection provider={provider} onSave={(data) => update(data)} showToast={showToast} />

            {/* Who collects the balance is a UNIT-level policy (payments
                meeting §5) — a solo provider is always settled through
                Healson, so the choice isn't offered there. */}
            {isUnitProvider(provider) && (
              <BalanceCollectionSection
                value={provider.balance_collector ?? "healson"}
                onChange={(balance_collector) => update({ balance_collector })}
              />
            )}

            {/* The provider's own view is about what reaches THEM — Healson's
                commission is not a line they manage, so it isn't shown here. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="הכנסה ברוטו" value={formatCurrency(completedRevenue)} tone="green" />
              <StatCard label="תשלום לספק" value={formatCurrency(netPayout)} tone="purple" />
              <StatCard label="ממתין לגבייה" value={formatCurrency(pendingCollectionPayout)} tone="amber" />
              <StatCard label="עסקאות שהושלמו" value={completedOrders.length} tone="blue" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>הכנסה חודשית</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChartSimple data={revenueMonthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>עסקאות אחרונות</CardTitle>
                <p className="text-sm text-slate-500">
                  &quot;תשלום לספק&quot; מחושב על סכומים שהתקבלו בפועל בלבד
                </p>
              </CardHeader>
              <CardContent>
                {myOrders.length === 0 ? (
                  <EmptyState title="אין עסקאות עדיין" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {myOrders.slice(0, 10).map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{o.patient_name} · {o.item_name}</span>
                          {o.status === "הושלם" && <StatusBadge status={o.payment_status ?? "ממתין"} kind="payment" />}
                        </div>
                        <div className="text-left">
                          <span className="font-medium text-slate-900">{formatCurrency(o.final_price)}</span>
                          {o.provider_payout_amount !== undefined && (
                            <p className="text-xs text-slate-400">
                              לתשלום לספק {formatCurrency(o.provider_payout_amount)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }}
    </ProfilePageFrame>
  );
}
