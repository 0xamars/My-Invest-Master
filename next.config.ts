import type { NextConfig } from "next";
import { INVEST_LEGACY_REDIRECTS } from "./src/lib/invest/legacy-redirects";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const securityHeaders = buildSecurityHeaders({
  production: isProduction,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return INVEST_LEGACY_REDIRECTS.map((entry) => ({
      source: entry.source,
      destination: entry.destination,
      permanent: entry.permanent,
    }));
  },
};

export default nextConfig;
