import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Original_Surfer } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import ConditionalHeader from "@/components/layout/ConditionalHeader";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const originalSurfer = Original_Surfer({
  variable: "--font-original-surfer",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Trippee",
  description: "Plan trips together with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${originalSurfer.variable} antialiased`}
      >
        <AuthProvider>
          <ConditionalHeader />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
