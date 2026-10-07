import OrdersList from "@/components/OrdersList";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  await requireSession();
  try {
    const orders = await listOrders();
    return (
      <section className="card">
        <h1 className="page-title">Pedidos</h1>
        <p className="lead">Consulta pedidos activos y actualiza su estado.</p>
        <OrdersList orders={orders} />
      </section>
    );
  } catch {
    return (
      <section className="card">
        <h1 className="page-title">Pedidos</h1>
        <div className="error">No se han podido cargar los pedidos desde Google Drive.</div>
      </section>
    );
  }
}
