import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <span className="eyebrow">404</span>
      <h1>Este contenido no está disponible.</h1>
      <p>Puede que no exista o que tu cuenta no tenga acceso a este espacio.</p>
      <Link className="button button-primary" href="/spaces">
        Volver a mis espacios
      </Link>
    </main>
  );
}
