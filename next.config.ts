import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NETLIFY ? {} : { output: "standalone" }),
};

export default nextConfig;
