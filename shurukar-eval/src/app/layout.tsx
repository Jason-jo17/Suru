import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShuruKar Evaluation Layer — Reviewer Workbench",
  description: "Institutional candidate review and Laya assessment workbench",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090D16] text-[#F8FAFC] antialiased selection:bg-sky-500/20 selection:text-sky-300">
        {children}
      </body>
    </html>
  );
}
