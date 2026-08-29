import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { BRAND, BRAND_SIZE } from "@/lib/brand/assets";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://investsalsa.com"),
  title: "InvestSalsa — Freedom, engineered.",
  description:
    "Budget, Invest, and Freedom. Ready to Assign leftover that carries, a portfolio book and checkup, and a Freedom plan you can refresh from the book. Not investment advice.",
  icons: {
    icon: [{ url: BRAND.logoMark, type: "image/jpeg" }],
    apple: BRAND.logoMark,
  },
  openGraph: {
    title: "InvestSalsa — Freedom, engineered.",
    description:
      "Budget leftover that carries, an Invest book, and a Freedom plan you can refresh from the book.",
    images: [
      {
        url: BRAND.logoLockup,
        width: BRAND_SIZE.logoLockup.width,
        height: BRAND_SIZE.logoLockup.height,
        alt: "InvestSalsa — Freedom, engineered.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InvestSalsa — Freedom, engineered.",
    description:
      "Budget leftover that carries, an Invest book, and a Freedom plan you can refresh from the book.",
    images: [BRAND.logoLockup],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
