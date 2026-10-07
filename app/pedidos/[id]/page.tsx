import { notFound } from "next/navigation";
import OrderDetail from "@/components/OrderDetail";
import { requireSession } from "@/lib/auth";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  try {
    const order = await getOrder(decodeURIComponent(id));
    if (!order) notFound();
    return <OrderDetail initial={order} />;
  } catch {
    return (
      <section className="card">
        <h1 className="page-title">Pedido</h1>
        <div className="error">No se ha podido leer el pedido desde Google Drive.</div>
      </section>
    );
  }
}
