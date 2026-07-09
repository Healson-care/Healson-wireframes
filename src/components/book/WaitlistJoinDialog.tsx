"use client";

import { ConfirmDialog } from "@/components/ui/Dialog";
import { useStore } from "@/lib/store";
import { ProviderProfile } from "@/types";

export function WaitlistJoinDialog({
  provider,
  slot,
  onClose,
  clientName,
  clientPhone,
  createdById,
}: {
  provider: ProviderProfile | null;
  slot: { date: string; time: string; label: string } | null;
  onClose: () => void;
  clientName: string;
  clientPhone?: string;
  createdById?: string;
}) {
  const addWaitlistEntry = useStore((s) => s.addWaitlistEntry);
  const showToast = useStore((s) => s.showToast);

  return (
    <ConfirmDialog
      open={!!slot && !!provider}
      onClose={onClose}
      title="הצטרפות לרשימת המתנה"
      description={
        slot && provider
          ? `נעדכן אתכם אם יתפנה תור אצל ${provider.title ?? ""} ${provider.display_name} ב-${slot.label} בשעה ${slot.time}.`
          : undefined
      }
      confirmLabel="הצטרפות"
      onConfirm={() => {
        if (!slot || !provider) return;
        addWaitlistEntry({
          provider_id: provider.id,
          provider_name: `${provider.title ?? ""} ${provider.display_name}`.trim(),
          client_name: clientName,
          client_phone: clientPhone,
          date: slot.date,
          time: slot.time,
          created_by_id: createdById,
        });
        showToast("נרשמת לרשימת ההמתנה", {
          description: "ניצור איתך קשר אם יתפנה תור במועד המבוקש",
          variant: "success",
        });
      }}
    />
  );
}
