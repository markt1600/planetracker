import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The catalogue is read from disk at runtime, so make sure it ships with the server functions.
  outputFileTracingIncludes: { "/**": ["./data/*.json"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
