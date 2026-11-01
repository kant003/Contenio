import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Contenio · Tu contenido, conectado",
    template: "%s · Contenio",
  },
  description:
    "Un espacio sencillo para crear, traducir y publicar tu contenido.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
