"use client";
import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe2,
  Plus,
  Search,
  LoaderCircle,
} from "lucide-react";
import type { ContentType } from "@/lib/types";
import {
  CONTENT_PAGE_SIZE,
  contentStatuses,
  contentHref,
  parseContentFilters,
  type ContentPage,
  type ContentFilters,
} from "@/lib/content-filters";
import { dateLabel } from "@/lib/utils";
import { Button } from "./ui/button";
export function ContentList({
  space,
  result,
  types,
  filters,
}: {
  space: string;
  result: ContentPage;
  types: ContentType[];
  filters: ContentFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { items, total, page, stats } = result;
  const { locale } = filters;
  const pageCount = Math.max(1, Math.ceil(total / CONTENT_PAGE_SIZE));
  const navigate = (next: ContentFilters) =>
    startTransition(() => {
      router.push(contentHref(space, next), { scroll: false });
    });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigate(
      parseContentFilters(
        Object.fromEntries(
          [...form].map(([key, value]) => [key, String(value)]),
        ),
      ),
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="row heading-kicker">
            <span className="eyebrow">CREA. ORGANIZA. CONECTA.</span>
            <span className="tiny-line" />
          </div>
          <h1>
            Contenido<span className="accent">.</span>
          </h1>
          <p>
            Tus ideas tienen un lugar. Dales forma y compártelas con el mundo.
          </p>
        </div>
        <details className="new-entry">
          <summary className="button button-primary">
            <Plus size={17} />
            Crear contenido
          </summary>
          <div className="popover">
            {types.length ? (
              types.map((t) => (
                <Link
                  key={t.id}
                  href={`/spaces/${space}/content/new?type=${t.id}&locale=${locale}`}
                >
                  <FileText size={16} />
                  {t.name}
                  <ArrowUpRight size={14} />
                </Link>
              ))
            ) : (
              <span>Crea primero un modelo.</span>
            )}
          </div>
        </details>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-icon violet">
            <FileText size={19} />
          </span>
          <div>
            <small>Total de entradas</small>
            <strong>
              {stats.total}
              <span>en este espacio</span>
            </strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon green">
            <Globe2 size={19} />
          </span>
          <div>
            <small>Con publicación</small>
            <strong>
              {stats.published}
              <span>listas para conectar</span>
            </strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon amber">
            <FileText size={19} />
          </span>
          <div>
            <small>Solo borradores</small>
            <strong>
              {stats.drafts}
              <span>ideas en marcha</span>
            </strong>
          </div>
        </div>
      </div>
      <section
        className="content-panel"
        aria-label="Listado de contenido"
        aria-busy={pending}
      >
        <div className="panel-title">
          <div>
            <h2>
              Todas las entradas <span className="count">{total}</span>
            </h2>
            <p>Un buen contenido empieza con una buena idea.</p>
          </div>
          <div className="row" role="status" aria-live="polite">
            {pending ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <span className="status-dot" />
            )}
            <small className="muted">
              {pending
                ? "Buscando contenido…"
                : `${total} ${total === 1 ? "entrada encontrada" : "entradas encontradas"}`}
            </small>
          </div>
        </div>
        <form
          className="filters"
          method="get"
          action={`/spaces/${space}/content`}
          onSubmit={submit}
        >
          <div className="search-input">
            <Search size={17} aria-hidden="true" />
            <input
              name="q"
              type="search"
              aria-label="Buscar contenido"
              placeholder="Buscar por título o slug…"
              defaultValue={filters.q}
              maxLength={256}
            />
          </div>
          <select
            name="type"
            aria-label="Tipo de contenido"
            defaultValue={filters.type}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="">Todos los modelos</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            aria-label="Estado"
            defaultValue={filters.status}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="">Todos los estados</option>
            {Object.entries(contentStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="locale"
            aria-label="Idioma del listado"
            defaultValue={locale}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="es">Español</option>
            <option value="gl">Galego</option>
          </select>
          <select
            name="sort"
            aria-label="Ordenar"
            defaultValue={filters.sort}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="updated">Más recientes</option>
            <option value="name">Título A–Z</option>
          </select>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Buscar
          </Button>
        </form>
        {(filters.q || filters.type || filters.status) && (
          <div className="active-filters">
            <span>Filtros aplicados{filters.q ? ` · «${filters.q}»` : ""}</span>
            <Link
              href={contentHref(space, {
                ...filters,
                q: "",
                type: "",
                status: "",
                page: 1,
              })}
              prefetch={false}
              scroll={false}
            >
              Limpiar filtros
            </Link>
          </div>
        )}
        <div className="table-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th>
                  Título <ArrowDown size={12} />
                </th>
                <th>Modelo</th>
                <th>Estado · {locale.toUpperCase()}</th>
                <th>Última edición</th>
                <th>
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const t = types.find((t) => t.id === e.content_type_id)!;
                const st = contentStatuses[e.status];
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/spaces/${space}/content/${e.id}?locale=${locale}`}
                        prefetch={false}
                        className="entry-title"
                      >
                        <span
                          className={`entry-icon ${t.key === "page" ? "violet" : "blue"}`}
                        >
                          <FileText size={17} />
                        </span>
                        <span>
                          <strong>{e.title}</strong>
                          <small>{e.slug}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="model-tag">{t.name}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${st === "Publicado" ? "published" : st === "Borrador" ? "draft" : "changed"}`}
                      >
                        <span />
                        {st}
                      </span>
                    </td>
                    <td className="date-cell">{dateLabel(e.updated_at)}</td>
                    <td>
                      <Link
                        aria-label={`Editar ${e.title}`}
                        className="table-arrow"
                        href={`/spaces/${space}/content/${e.id}?locale=${locale}`}
                        prefetch={false}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <div className="empty">
            <span className="empty-icon">
              <FileText size={27} />
            </span>
            <h3>
              {stats.total
                ? "No encontramos ese contenido"
                : "Tu próxima idea empieza aquí"}
            </h3>
            <p>
              {stats.total
                ? "Prueba con otro título o cambia los filtros."
                : "Crea tu primera entrada para darle forma."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {total
              ? `${(page - 1) * CONTENT_PAGE_SIZE + 1}–${Math.min(page * CONTENT_PAGE_SIZE, total)} de ${total} entradas`
              : "Sin entradas"}
          </span>
          <div className="row">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={pending || page === 1}
              onClick={() => navigate({ ...filters, page: page - 1 })}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              disabled={pending || page >= pageCount}
              onClick={() => navigate({ ...filters, page: page + 1 })}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      <div className="bottom-note">
        <span className="note-icon">
          <Globe2 size={18} />
        </span>
        <p>
          <strong>Un contenido. Infinitas posibilidades.</strong> Conecta lo que
          publicas con tus webs a través de la API.
        </p>
        <Link href="/docs">
          Ver documentación <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}
