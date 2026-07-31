import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://showdeck.live"),
  title: "Showdeck — Plan every episode, together",
  description: "The collaborative show planning workspace for podcast and radio teams. Plan segments, manage runsheets, and keep your whole team in sync.",
  applicationName: "Showdeck",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Showdeck",
  },
  openGraph: {
    title: "Showdeck — Plan every episode, together",
    description: "The collaborative show planning workspace for podcast and radio teams.",
    url: "https://showdeck.live",
    siteName: "Showdeck",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Showdeck — Plan every episode, together",
    description: "The collaborative show planning workspace for podcast and radio teams.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
