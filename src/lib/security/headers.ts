/**
 * Practical security headers. CSP lists origins this app actually talks to
 * in the browser: self, Supabase auth/realtime, logo CDNs, and Vercel preview
 * toolbar. Server-only providers (FMP, Yahoo, CoinGecko fetch, OpenRouter)
 * stay off connect-src.
 */

const BASE_CONNECT = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://vercel.live",
  "https://*.vercel.live",
  "wss://*.pusher.com",
];

export function buildContentSecurityPolicy(options?: {
  supabaseUrl?: string | null;
}): string {
  const connect = [...BASE_CONNECT];
  const supabaseUrl = options?.supabaseUrl?.trim();
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      const origin = parsed.origin;
      if (!connect.includes(origin)) connect.push(origin);
      if (parsed.protocol === "https:") {
        const ws = `wss://${parsed.host}`;
        if (!connect.includes(ws)) connect.push(ws);
      }
    } catch {
      // Ignore malformed env — wildcard supabase.co still applies.
    }
  }

  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(options?: {
  production?: boolean;
  supabaseUrl?: string | null;
}): { key: string; value: string }[] {
  const headers: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({
        supabaseUrl: options?.supabaseUrl,
      }),
    },
  ];

  if (options?.production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
