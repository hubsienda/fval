import Image from "next/image";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/pedido");
  return (
    <section className="login-wrap">
      <div className="card login-card">
        <Image className="login-logo" src="/logo/logo.png" alt="FRUKLAS" width={320} height={110} priority />
        <h1 className="page-title">FVAL</h1>
        <p className="lead">Acceso privado para gestión operativa de pedidos.</p>
        <LoginForm />
      </div>
    </section>
  );
}
