"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function navClass(active: boolean) {
  return active ? "nav-link active" : "nav-link";
}

export default function Header() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const ordersActive = pathname === "/pedidos" || (pathname.startsWith("/pedidos/") && !pathname.startsWith("/pedidos/archivados"));
  const archivedActive = pathname.startsWith("/pedidos/archivados");

  return (
    <header className="topbar no-print">
      <div className="brand">
        <Image src="/logo/logo.png" alt="FRUKLAS" width={148} height={48} priority />
        <span>FVAL</span>
      </div>
      <nav aria-label="Navegación principal">
        <Link className={navClass(pathname === "/pedido")} aria-current={pathname === "/pedido" ? "page" : undefined} href="/pedido">
          Nueva venta
        </Link>
        <Link className={navClass(ordersActive)} aria-current={ordersActive ? "page" : undefined} href="/pedidos">
          Pedidos
        </Link>
        <Link className={navClass(archivedActive)} aria-current={archivedActive ? "page" : undefined} href="/pedidos/archivados">
          Archivados
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className="link-button logout-button" type="submit">
            <span className="logout-desktop">Cerrar sesión</span>
            <span className="logout-mobile">Salir</span>
          </button>
        </form>
      </nav>
    </header>
  );
}
