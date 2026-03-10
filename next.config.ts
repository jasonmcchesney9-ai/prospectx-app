import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  turbopack: {
    root: __dirname,
  },
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
  async redirects() {
    return [
      { source: "/scouting", destination: "/watchlist", permanent: false },
    ];
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://assets.leaguestat.com https://lscluster.hockeytech.com https://*.up.railway.app http://localhost:8000 http://127.0.0.1:8000",
              "connect-src 'self' https://assets.leaguestat.com https://lscluster.hockeytech.com https://*.up.railway.app http://localhost:8000 http://127.0.0.1:8000 https://*.mux.com https://*.production.mux.com https://unpkg.com",
              "media-src 'self' blob: https://*.mux.com https://*.production.mux.com",
              "worker-src 'self' blob:",
              "frame-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // FFmpeg WASM requires these headers for SharedArrayBuffer support.
        // Only applied to the upload page to avoid breaking Mux player embeds elsewhere.
        source: "/film/upload",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
