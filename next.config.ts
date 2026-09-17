import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The prototype keeps all state server-side in a module singleton.
  // No database, no external persistence.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
