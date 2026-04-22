import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ErrorBoundary, GlobalErrorListeners } from "@/components/error-boundary";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PEV CRM",
  description: "Plateforme de gestion de dossiers de financement",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased bg-white text-gray-900`}>
        <GlobalErrorListeners />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
