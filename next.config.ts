import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.leaguestat.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lscluster.hockeytech.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
