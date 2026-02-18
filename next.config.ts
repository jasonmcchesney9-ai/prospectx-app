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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://assets.leaguestat.com https://lscluster.hockeytech.com https://*.up.railway.app http://localhost:8000 http://127.0.0.1:8000",
              "connect-src 'self' https://*.up.railway.app http://localhost:8000 http://127.0.0.1:8000",
              "frame-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
