import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RBK Digital",
  description: "Gestão documental RBK Digital",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
