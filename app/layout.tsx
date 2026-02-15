import type { Metadata } from "next";
import "./globals.css";
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
        <BenchTalkProvider>
          <ContentWrapper>{children}</ContentWrapper>
          <BenchTalkDrawer />
        </BenchTalkProvider>
      </body>
    </html>
  );
}
