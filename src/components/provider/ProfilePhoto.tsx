"use client";

import { useState, type ReactNode } from "react";
import { Camera, Eye, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProfilePhotoField } from "@/components/provider/ProfilePhotoField";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ProviderProfile } from "@/types";

/**
 * The provider's profile picture, edited the way every real product edits one:
 * you click the avatar itself. Before this, the only way in was a chip in the
 * onboarding meter — which vanished the moment setup finished, leaving a
 * provider who skipped it with no obvious way back.
 *
 * Two exports, one dialog between them:
 *   • ProfilePhotoDialog — the upload surface plus the reason to bother.
 *   • EditableProfileAvatar — an avatar that opens it, wearing a camera badge.
 *
 * "Recommended" is said in the interface, not only in copy: with no photo the
 * avatar carries a dashed gold ring and a pulsing badge, so it reads as an
 * unfinished field rather than a finished one that happens to show initials.
 */

export function ProfilePhotoDialog({
  provider,
  open,
  onClose,
}: {
  provider: ProviderProfile;
  open: boolean;
  onClose: () => void;
}) {
  const updateProviderById = useStore((s) => s.updateProviderById);
  const showToast = useStore((s) => s.showToast);
  const hasPhoto = !!provider.image_url;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={hasPhoto ? "תמונת פרופיל" : "העלאת תמונת פרופיל"}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <ProfilePhotoField
          name={provider.display_name}
          imageUrl={provider.image_url}
          onUpload={(url) => {
            updateProviderById(provider.id, { image_url: url });
            showToast("תמונת הפרופיל נשמרה", { variant: "success" });
          }}
        />

        {/* Why it matters, in terms of what the patient sees — not a nag. */}
        <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-bg/50 p-3.5">
          <p className="text-xs font-semibold text-slate-800">למה זה מומלץ מאוד</p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text" />
            זו התמונה שמטופלים רואים בתוצאות החיפוש, לצד כל פריט שלך — היא לרוב הדבר הראשון
            שמבחינים בו.
          </p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text" />
            כרטיס בלי תמונה מציג את ראשי התיבות של השם, ונראה חסר לצד כרטיסים שיש בהם תמונה.
          </p>
        </div>

        <p className="text-[11px] text-slate-400">
          קבצי JPG או PNG. אפשר להחליף את התמונה בכל רגע — כאן, או דרך פרופיל ← הגדרות.
        </p>

        <Button className="self-end" variant={hasPhoto ? "primary" : "outline"} onClick={onClose}>
          {hasPhoto ? "סיום" : "אעלה מאוחר יותר"}
        </Button>
      </div>
    </Dialog>
  );
}

export function EditableProfileAvatar({
  provider,
  fallbackName,
  className,
  badgeClassName,
  label = "תמונת פרופיל",
}: {
  provider: ProviderProfile;
  /** Shown while the profile has no display_name of its own (fresh accounts). */
  fallbackName?: string;
  className?: string;
  badgeClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasPhoto = !!provider.image_url;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hasPhoto ? "החלפת תמונת הפרופיל" : "העלאת תמונת פרופיל — מומלץ מאוד"}
        aria-label={hasPhoto ? `החלפת ${label}` : `העלאת ${label} — מומלץ מאוד`}
        className="group focus-ring relative shrink-0 rounded-full"
      >
        <Avatar
          name={provider.display_name || fallbackName || ""}
          src={provider.image_url}
          className={cn(
            "transition-opacity group-hover:opacity-80",
            // An empty photo is an unfinished field, and should look like one.
            !hasPhoto && "ring-2 ring-accent ring-offset-2 ring-offset-white",
            className
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -left-0.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110",
            hasPhoto
              ? "bg-slate-700 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              : "bg-accent text-white animate-pulse",
            badgeClassName ?? "h-5 w-5"
          )}
        >
          <Camera className="h-2.5 w-2.5" />
        </span>
      </button>
      <ProfilePhotoDialog provider={provider} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Menu-row wrapper for the same dialog — used where the avatar itself is
 * already a menu trigger and can't nest a second button inside it. */
export function ProfilePhotoMenuLabel({ hasPhoto }: { hasPhoto: boolean }): ReactNode {
  return (
    <>
      <Camera className="h-4 w-4" />
      {hasPhoto ? "החלפת תמונת פרופיל" : "העלאת תמונת פרופיל"}
      {!hasPhoto && (
        <span className="mr-auto rounded-full bg-accent-bg px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">
          מומלץ
        </span>
      )}
    </>
  );
}
