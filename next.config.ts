import type { NextConfig } from "next";
// Fail the production build if required env vars are missing (see lib/env.ts).
import "./lib/env";

// `next dev` compiles client chunks with eval, so without this the CSP blocks
// hydration locally and the app renders but never becomes interactive.
const scriptSrc = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; ${scriptSrc}; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`,
  },
];

const nextConfig: NextConfig = {
    devIndicators: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  outputFileTracingIncludes: {
    "/d/[id]/opengraph-image": ["./lib/fonts/**"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
