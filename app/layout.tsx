import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import BenchTalkProvider from "@/components/BenchTalkProvider";
import BenchTalkDrawer from "@/components/BenchTalkDrawer";
import ContentWrapper from "@/components/ContentWrapper";
import ImpersonateBanner from "@/components/admin/ImpersonateBanner";
import UploadProvider from "@/contexts/UploadContext";

export const metadata: Metadata = {
  title: "ProspectX Intelligence",
  description: "Decision-Grade Hockey Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D9488" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ProspectX" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});}`,
          }}
        />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: "#0F2A3D", color: "#fff", fontSize: "14px", borderRadius: "12px" },
            success: { iconTheme: { primary: "#18B3A6", secondary: "#fff" } },
            error: { iconTheme: { primary: "#F36F21", secondary: "#fff" } },
          }}
        />
        <ImpersonateBanner />
        <UploadProvider>
          <BenchTalkProvider>
            <ContentWrapper>{children}</ContentWrapper>
            <BenchTalkDrawer />
          </BenchTalkProvider>
        </UploadProvider>
      </body>
    </html>
  );
}
