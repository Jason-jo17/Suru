import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShuruKar — Reviewer Workbench",
  description: "Founder review and Laya assessment workbench for ShuruKar",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased selection:bg-accent-soft selection:text-ink">
        {children}
      </body>
    </html>
  );
}
