"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <h1>No hemos podido cargar este espacio.</h1>
      <p>
        Comprueba la conexión con PostgreSQL e inténtalo de nuevo. Tu contenido
        guardado permanece en la base de datos.
      </p>
      <Button onClick={reset}>Volver a intentarlo</Button>
    </main>
  );
}
