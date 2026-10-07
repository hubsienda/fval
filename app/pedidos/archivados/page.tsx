import OrdersList from "@/components/OrdersList";
import { requireSession } from "@/lib/auth";
import { listArchivedOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function ArchivedOrdersPage() {
  await requireSession();
  try {
    const orders = await listArchivedOrders();
    return (
      <section className="card">
        <h1 className="page-title">Pedidos archivados</h1>
        <p className="lead">Consulta pedidos retirados de la lista operativa.</p>
        <OrdersList orders={orders} basePath="/pedidos/archivados" />
      </section>
    );
  } catch {
    return (
      <section className="card">
        <h1 className="page-title">Pedidos archivados</h1>
        <div className="error">No se han podido cargar los pedidos archivados desde Google Drive.</div>
      </section>
    );
  }
}
