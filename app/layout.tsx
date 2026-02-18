import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GDG Busan - Build with AI | Vote",
  description:
    "GDG Busan 해커톤 투표 플랫폼 - 최고의 AI 프로젝트에 투표하세요!",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased min-h-screen dot-grid`}
      >
        <div className="scanline fixed inset-0 z-50" />
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1A2235",
              border: "1px solid rgba(0, 255, 136, 0.2)",
              color: "#E8F4FD",
            },
          }}
        />
      </body>
    </html>
  );
}
