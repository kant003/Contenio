import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  ImageIcon,
  Layers3,
  LogOut,
  Settings2,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { Space } from "@/lib/types";
export function Shell({
  space,
  spaces,
  email,
  isAdmin,
  section,
  children,
}: {
  space: Space;
  spaces: Space[];
  email: string;
  isAdmin: boolean;
  section: string;
  children: React.ReactNode;
}) {
  const items = [
    { key: "content", label: "Contenido", icon: FileText },
    { key: "models", label: "Modelos", icon: Boxes },
    { key: "media", label: "Archivos", icon: ImageIcon },
    ...(isAdmin
      ? [{ key: "settings", label: "Ajustes", icon: Settings2 }]
      : []),
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Link href="/spaces" className="brand">
          <span className="brand-mark">
            <Layers3 size={20} />
          </span>
          contenio<span className="brand-period">.</span>
        </Link>
        <details className="space-picker">
          <summary>
            <span className="space-avatar">
              {space.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <small>ESPACIO DE TRABAJO</small>
              <strong>{space.name}</strong>
            </span>
            <ChevronDown size={14} />
          </summary>
          <div className="space-options">
            {spaces.map((s) => (
              <Link key={s.id} href={`/spaces/${s.id}/content`}>
                {s.name}
                {s.id === space.id && <span className="status-dot" />}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/spaces">
                Gestionar espacios <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        </details>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {items.map((item) => (
            <Link
              key={item.key}
              href={`/spaces/${space.id}/${item.key}`}
              className={`nav-item ${section === item.key ? "active" : ""}`}
            >
              <item.icon size={18} />
              {item.label}
              {section === item.key && <span className="nav-current" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/docs" className="nav-item">
            <BookOpen size={17} />
            Guía de la API
            <ArrowUpRight size={13} />
          </Link>
          <div className="sidebar-tip">
            <Code2 size={19} />
            <strong>Crea aquí. Publica donde quieras.</strong>
            <p>Tu contenido, listo para conectar con cualquier web.</p>
          </div>
          <div className="account">
            <span className="account-avatar">
              {email.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{isAdmin ? "Administrador" : "Editor"}</strong>
              <small>{email}</small>
            </div>
            <form action={logoutAction}>
              <button title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <Layers3 size={15} />
            <span>{space.name}</span>
            <ChevronRight size={13} />
            <strong>
              {items.find((i) => i.key === section)?.label ?? "Contenido"}
            </strong>
          </div>
          <span className="private-label">
            <span className="status-dot" />
            Espacio privado
          </span>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            contenio <span>·</span> Un lugar para tus ideas.
          </span>
          <span>ES / GL</span>
        </footer>
      </div>
    </div>
  );
}
