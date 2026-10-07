import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth + cookies + department switcher need request-time rendering.
  // Revisit Cache Components in a later phase once patterns settle.
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
