"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { useStore } from "@/lib/store";
import { MonthlySettlementSection } from "@/components/provider/MonthlySettlementSection";
import { MonthlyReportSection } from "@/components/provider/MonthlyReportSection";

export default function ProviderReportsPage() {
  const orders = useStore((s) => s.orders);
  return (
    <ProfilePageFrame title="דוחות" description="התחשבנות חודשית ודוחות פעילות">
      {({ provider, update, showToast }) => {
        const myOrders = orders.filter((o) => o.provider_id === provider.id);
        return (
          <div className="flex flex-col gap-4">
            <MonthlySettlementSection
              orders={myOrders}
              settlements={provider.monthly_settlements ?? []}
              onChange={(monthly_settlements) => update({ monthly_settlements })}
              showToast={showToast}
            />
            <MonthlyReportSection orders={myOrders} providerName={provider.display_name} />
          </div>
        );
      }}
    </ProfilePageFrame>
  );
}
