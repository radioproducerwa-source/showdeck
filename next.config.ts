import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  // Source-map upload is skipped without a SENTRY_AUTH_TOKEN; error capture
  // still works. Add the token + org/project later to get readable stack traces.
  silent: !process.env.CI,
  disableLogger: true,
});
