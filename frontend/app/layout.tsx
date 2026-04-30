import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/ToastContext";
import { SegmentProvider } from "@/lib/SegmentContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import ToastContainer from "@/components/ToastContainer";
import GlobalFooter from "@/components/GlobalFooter";
import { BRAND } from "@/lib/constants";



export const metadata: Metadata = {
  title: BRAND.title,
  description: BRAND.description,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Roomivo",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`font-sans antialiased`}
      >
        <LanguageProvider>
          <ToastProvider>
            <SegmentProvider>
              <div className="flex flex-col min-h-screen">
                {children}
                <ToastContainer />
                <GlobalFooter />
              </div>
            </SegmentProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
