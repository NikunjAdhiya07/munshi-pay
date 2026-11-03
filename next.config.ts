import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second build folder lets a check server run next to `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
