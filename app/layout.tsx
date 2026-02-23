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

const siteUrl = "https://two026-build-with-ai-hackaton-in-busan.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GDG Busan - Build with AI | Vote",
  description:
    "GDG Busan 해커톤 투표 플랫폼 - 최고의 AI 프로젝트에 투표하세요!",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "GDG Busan - Build with AI 2026",
    description: "25팀의 AI 프로젝트 중 최고를 투표하세요! 🗳️",
    url: siteUrl,
    siteName: "GDG Busan Hackathon Vote",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GDG Busan - Build with AI 2026",
    description: "25팀의 AI 프로젝트 중 최고를 투표하세요!",
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
    <html lang="ko" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased min-h-screen dot-grid`}
      >
        <div className="scanline fixed inset-0 z-50" />
        <Providers>
          {children}
          <footer className="flex justify-center py-4 mt-auto">
            <a
              href="https://github.com/gdg-busan/2026-Build-with-AI-Hackaton-in-Busan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono text-white/30 hover:text-[#00FF88]/70 transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub Source
            </a>
          </footer>
        </Providers>
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
