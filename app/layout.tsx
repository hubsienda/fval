import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FVAL · FRUKLAS",
  description: "Aplicación operativa de pedidos FRUKLAS",
  icons: { icon: "/logo/favicon.jpg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="topbar no-print">
          <div className="brand">
            <Image src="/logo/logo.png" alt="FRUKLAS" width={148} height={48} priority />
            <span>FVAL</span>
          </div>
          <nav>
            <Link href="/pedido">Nueva venta</Link>
            <Link href="/pedidos">Pedidos</Link>
            <form action="/api/auth/logout" method="post">
              <button className="link-button" type="submit">Cerrar sesión</button>
            </form>
          </nav>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
