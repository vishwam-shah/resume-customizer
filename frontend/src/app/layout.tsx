import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { OfflineBanner } from "@/features/pwa/OfflineBanner";
import { AppProviders } from "./AppProviders";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Tailor · Resume customizer", template: "%s · Tailor" },
  description:
    "Paste a job description, upload your resume, and get a version tailored to the role. Every change is grounded in what you actually did.",
  applicationName: "Tailor",
  appleWebApp: { capable: true, title: "Tailor", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Tailor · Resume customizer",
    description: "Tailor your resume to any job description, honestly.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <AppProviders>
          <SkipLink />
          <OfflineBanner />
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
          <MobileTabBar />
        </AppProviders>
      </body>
    </html>
  );
}
