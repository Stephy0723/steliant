import type { NextConfig } from "next";

const base = process.env.TS_BASE ?? "/demos/tour-steliant";
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: base,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE: base },
};
export default nextConfig;
