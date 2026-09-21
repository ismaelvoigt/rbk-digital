import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RBK Digital",
  description: "Gestão documental RBK Digital",
  icons: {
    icon: "/rbk-favicon.png",
    apple: "/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "RBK Digital",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
