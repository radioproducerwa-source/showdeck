import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  org: "showdeck-6h",
  project: "javascript-nextjs",
  // Source maps upload during Production/Preview builds using SENTRY_AUTH_TOKEN
  // (set in Vercel). Falls back to no upload if the token is absent.
  silent: !process.env.CI,
});
