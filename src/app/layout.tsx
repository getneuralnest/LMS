import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Class Portal",
  description: "Class attendance, ledger, and learning portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
