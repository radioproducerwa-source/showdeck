import type { Metadata } from "next";
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
  title: "Showdeck",
  description: "The collaborative show planning workspace",
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
      suppressHydrationWarning
    >
      {/* Restore saved theme before first paint to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('showdeck_theme') || 'light';
            var themes = {
              dark: {'--t-bg':'#0d0d0f','--t-surface':'#1a1a1a','--t-border':'#2a2a2a','--t-accent':'#00e5a0','--t-accent-hover':'#00ffc0','--t-accent-dark':'#00a870','--t-text':'#f0f0f0','--t-muted':'#888899','--t-dim':'#555566','--t-nav-bg':'#111113'},
              light: {'--t-bg':'#f7f8fa','--t-surface':'#ffffff','--t-border':'#e2e4e8','--t-accent':'#00e5a0','--t-accent-hover':'#00ffc0','--t-accent-dark':'#00a870','--t-text':'#0d0d0f','--t-muted':'#6b6b7a','--t-dim':'#c8cad0','--t-nav-bg':'#ffffff'},
              midnight: {'--t-bg':'#0a0f1e','--t-surface':'#111827','--t-border':'#1e2a40','--t-accent':'#4fc3f7','--t-accent-hover':'#81d4fa','--t-accent-dark':'#29b6f6','--t-text':'#e2e8f0','--t-muted':'#7a8aaa','--t-dim':'#3a4a66','--t-nav-bg':'#080d18'},
              charcoal: {'--t-bg':'#1a1a1a','--t-surface':'#242424','--t-border':'#333333','--t-accent':'#ff6b6b','--t-accent-hover':'#ff8c8c','--t-accent-dark':'#e05555','--t-text':'#f0f0f0','--t-muted':'#8a8a8a','--t-dim':'#555555','--t-nav-bg':'#111111'},
            };
            var vars = themes[t] || themes.light;
            Object.keys(vars).forEach(function(k){ document.documentElement.style.setProperty(k,vars[k]); });
            document.documentElement.setAttribute('data-theme', t);
          } catch(e){}
        `}} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
