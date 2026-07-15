import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/ToastContext";
import { SegmentProvider } from "@/lib/SegmentContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import ToastContainer from "@/components/ToastContainer";
import GlobalFooter from "@/components/GlobalFooter";
import { BRAND, SITE_URL } from "@/lib/constants";



export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND.title,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
    languages: {
      fr: "/",
      en: "/",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Roomivo",
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: BRAND.title,
    description: BRAND.description,
    url: SITE_URL,
    siteName: BRAND.name,
    locale: "fr_FR",
    alternateLocale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} Preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.title,
    description: BRAND.description,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b", // Zinc-900
  width: "device-width",
  initialScale: 1,
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: SITE_URL,
    description: BRAND.description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  // Escape < to block </script> breakout if a config-derived field ever holds one.
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
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
