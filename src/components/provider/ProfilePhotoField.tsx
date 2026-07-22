"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";
import { useStore } from "@/lib/store";
import { fileToDataUrl } from "@/lib/file";

/** Avatar preview + upload control for the provider's profile picture — the
 * single upload UI shared by the onboarding "תמונת פרופיל" step and the
 * profile settings editor, so both save the same downscaled data URL. */
export function ProfilePhotoField({
  name,
  imageUrl,
  onUpload,
}: {
  name: string;
  imageUrl?: string;
  onUpload: (url: string) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [uploading, setUploading] = useState(false);

  async function handleSelect(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await fileToDataUrl(file);
      onUpload(url);
    } catch (err) {
      showToast("שגיאה בהעלאת התמונה", {
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={imageUrl} className="h-16 w-16 text-lg" />
      <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary">
        <Upload className="h-4 w-4" />
        {uploading ? "מעלה..." : imageUrl ? "החלפת תמונת פרופיל" : "העלאת תמונת פרופיל"}
        <input
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
      </label>
    </div>
  );
}
