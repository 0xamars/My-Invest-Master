import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#121212",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://investsalsa.com"),
  title: "InvestSalsa — Freedom, engineered.",
  description:
    "Budget, Invest, and Freedom. Envelope leftover that carries, a portfolio book and checkup, and a Freedom plan you can refresh from the book. Not investment advice.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "InvestSalsa — Freedom, engineered.",
    description:
      "Budget leftover that carries, an Invest book, and a Freedom plan you can refresh from the book.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "InvestSalsa — Freedom, engineered.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InvestSalsa — Freedom, engineered.",
    description:
      "Budget leftover that carries, an Invest book, and a Freedom plan you can refresh from the book.",
    images: ["/og.png"],
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
      className={`dark ${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${inter.className} min-h-full font-sans`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
