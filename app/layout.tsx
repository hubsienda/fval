import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "FVAL · FRUKLAS",
  description: "Aplicación operativa de pedidos FRUKLAS",
  icons: { icon: "/logo/favicon.jpg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
