import OrderForm from "@/components/OrderForm";
import { requireSession } from "@/lib/auth";
import { getClients, getEmployees, getProducts } from "@/lib/google";

export const dynamic = "force-dynamic";

function todayMadrid() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function PedidoPage() {
  await requireSession();
  let clients = [], products = [], employees = [];
  try {
    [clients, products, employees] = await Promise.all([getClients(), getProducts(), getEmployees()]);
  } catch {
    return (
      <section className="card">
        <h1 className="page-title">Nueva venta</h1>
        <div className="error">No se han podido cargar los datos de Google Sheets. Comprueba la conexión e inténtalo de nuevo.</div>
      </section>
    );
  }
  return <OrderForm clients={clients} products={products} employees={employees} today={todayMadrid()} />;
}
