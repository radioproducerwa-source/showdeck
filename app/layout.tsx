import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { THEMES, DEFAULT_THEME, type ThemeKey } from "../lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Showdeck",
  description: "The collaborative show planning workspace",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get("showdeck_theme")?.value;
  const themeKey: ThemeKey = (rawTheme && rawTheme in THEMES) ? rawTheme as ThemeKey : DEFAULT_THEME;
  const themeVars = THEMES[themeKey].vars;
  const themeStyle = Object.fromEntries(Object.entries(themeVars)) as React.CSSProperties & Record<string, string>;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme={themeKey}
      style={themeStyle}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
