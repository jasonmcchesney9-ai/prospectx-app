import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
