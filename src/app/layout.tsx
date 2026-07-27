import type { Metadata } from "next";
import { Rubik, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Elegant Hebrew serif — used for the premium display headings on the provider
// onboarding "signature moment" surfaces (exposed as --font-display / .font-display).
const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-display",
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  title: "HEALSON | פלטפורמת בריאות",
  description: "פלטפורמת ניהול וזימון שירותי בריאות בישראל",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${frankRuhl.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
