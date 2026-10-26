import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorReporter } from "@/components/error-reporter";
import { ThemeSync } from "@/components/theme-sync";
import { CHURCH } from "@/lib/church";
import { TITLE_SUFFIX, siteUrl } from "@/lib/seo";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: CHURCH.fullName,
    template: `%s${TITLE_SUFFIX}`,
  },
  description: `${CHURCH.tagline}.`,
  openGraph: {
    type: "website",
    siteName: CHURCH.fullName,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

const themeScript = `(function(){try{var t=localStorage.getItem('fbc-pittsgrove-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const csp = (await headers()).get("Content-Security-Policy");
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} ${body.variable}`}>
        <Script id="fbc-pittsgrove-theme" strategy="beforeInteractive" nonce={nonce}>
          {themeScript}
        </Script>
        <ThemeSync />
        <SpeedInsights />
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
