/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  webpack: (config, { isServer }) => {
    // Exclude the scripts directory from webpack processing
    config.externals = [...(config.externals || []), 'scripts/'];
    
    return config;
  },
  eslint: {
    // Skip ESLint during builds
    ignoreDuringBuilds: true,
  },
  output: 'export',
};

export default config;
