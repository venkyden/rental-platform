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
  themeColor: "#18181b", // Zinc-900
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import Script from "next/script";

// Using system font stack for reliability in restricted environments
const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

import { AuthProvider } from "@/lib/AuthContext";
import CookieConsentBanner from "@/components/CookieConsentBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Load Google Identity Services script once */}
        <Script 
          src="https://accounts.google.com/gsi/client" 
          strategy="afterInteractive"
        />
      </head>
      <body
        className="antialiased bg-zinc-50 text-zinc-900 min-h-screen selection:bg-zinc-900 selection:text-white"
        style={{ fontFamily: fontStack }}
      >
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <SegmentProvider>
                <div className="flex flex-col min-h-screen">
                  {children}
                  <ToastContainer />
                  <GlobalFooter />
                  <CookieConsentBanner />
                </div>
              </SegmentProvider>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
