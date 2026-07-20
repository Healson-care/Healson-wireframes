// Small client-side file helper — reused for lab-result, referral-document,
// visit-record, and profile-photo uploads. Files are stored as data URLs in
// localStorage since there is no real backend/object storage in this mock
// app — localStorage has a hard ~5-10MB-per-origin quota shared by the
// entire persisted store, so a single uncompressed photo/PDF can blow past
// it and break every subsequent write in the app (QuotaExceededError).
// Images are therefore downscaled + re-encoded before storage, and
// non-image files are capped, with a friendly error the caller can toast.
const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_JPEG_QUALITY = 0.82;
const MAX_NON_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

/** Same limits fileToDataUrl actually enforces, checked up front so callers
 * can reject a bad file (and tell the user why) before ever reading it. */
export function validateDocumentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "סוג קובץ לא נתמך — יש להעלות PDF, JPG או PNG בלבד";
  }
  if (!file.type.startsWith("image/") && file.size > MAX_NON_IMAGE_BYTES) {
    return `הקובץ גדול מדי — הגודל המקסימלי הוא ${MAX_NON_IMAGE_BYTES / (1024 * 1024)}MB`;
  }
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    return compressImageToDataUrl(file);
  }
  if (file.size > MAX_NON_IMAGE_BYTES) {
    return Promise.reject(
      new Error(`הקובץ גדול מדי (מקסימום ${MAX_NON_IMAGE_BYTES / (1024 * 1024)}MB) — האחסון בדפדפן מוגבל בנפח`)
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("שגיאה בעיבוד התמונה"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("שגיאה בטעינת התמונה"));
    };
    img.src = objectUrl;
  });
}
