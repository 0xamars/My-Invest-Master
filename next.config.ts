import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const securityHeaders = buildSecurityHeaders({
  production: isProduction,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const nextConfig: NextConfig = {
  headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
