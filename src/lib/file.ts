// Small client-side file helper — reused for lab-result and referral-document
// uploads (PRV-05, PAT-06). Files are stored as data URLs in localStorage
// since there is no real backend/object storage in this mock app.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
