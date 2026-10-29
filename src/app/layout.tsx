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
      <body>
        {process.env.NEXT_PUBLIC_RBK_ENV === "development" && (
          <div role="status" style={{padding:"10px 16px",background:"#fef3c7",color:"#713f12",textAlign:"center",fontSize:14,fontWeight:700}}>
            Ambiente de desenvolvimento e testes — use somente dados fictícios
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
