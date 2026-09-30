import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akari — light up every cell",
  description:
    "A neon Light Up (Akari) puzzle built with Next.js and TypeScript. Place light bulbs so every white cell is lit, no two bulbs shine on each other, and each numbered wall touches exactly that many bulbs. Every board has exactly one solution and never needs a guess.",
};

export const viewport: Viewport = {
  themeColor: "#070610",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
