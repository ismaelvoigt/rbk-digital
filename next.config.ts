import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/portal/credenciamento": ["./src/lib/credenciamento/form.html"] },
  allowedDevOrigins: ["192.168.15.73"],
};

export default nextConfig;
