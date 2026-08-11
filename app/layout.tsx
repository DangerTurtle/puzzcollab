import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulletin",
  description: "Private bulletin boards for you and your followers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
