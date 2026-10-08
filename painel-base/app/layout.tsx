import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recanto das Asas · Painel do criatório",
  description: "Administração privada de aves, casais, posturas, filhotes e parentesco do Recanto das Asas.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
