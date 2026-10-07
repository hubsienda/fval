import { notFound } from "next/navigation";
import OrderDetail from "@/components/OrderDetail";
import { requireSession } from "@/lib/auth";
import { getArchivedOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function ArchivedOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  try {
    const order = await getArchivedOrder(decodeURIComponent(id));
    if (!order) notFound();
    return <OrderDetail initial={order} archived />;
  } catch {
    return (
      <section className="card">
        <h1 className="page-title">Pedido archivado</h1>
        <div className="error">No se ha podido leer el pedido archivado desde Google Drive.</div>
      </section>
    );
  }
}
