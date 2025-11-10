import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/shared/ThemeProvider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import PWARegister from "@/components/shared/PWARegister";

export const metadata: Metadata = {
  title: "Adaptive Reader",
  description: "A serene, intelligent e-reading experience",
  manifest: "/manifest.json",
  themeColor: "#1A1A1A",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reader",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        <ErrorBoundary level="app">
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
