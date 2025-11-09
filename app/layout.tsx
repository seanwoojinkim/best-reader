import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/shared/ThemeProvider";

export const metadata: Metadata = {
  title: "Adaptive Reader",
  description: "A serene, intelligent e-reading experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
