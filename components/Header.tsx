"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
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
  );
}
