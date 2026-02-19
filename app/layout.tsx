import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import BenchTalkProvider from "@/components/BenchTalkProvider";
import BenchTalkDrawer from "@/components/BenchTalkDrawer";
import ContentWrapper from "@/components/ContentWrapper";

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
      <body className="antialiased" suppressHydrationWarning>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: "#0F2A3D", color: "#fff", fontSize: "14px", borderRadius: "12px" },
            success: { iconTheme: { primary: "#18B3A6", secondary: "#fff" } },
            error: { iconTheme: { primary: "#F36F21", secondary: "#fff" } },
          }}
        />
        <BenchTalkProvider>
          <ContentWrapper>{children}</ContentWrapper>
          <BenchTalkDrawer />
        </BenchTalkProvider>
      </body>
    </html>
  );
}
