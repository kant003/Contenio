"use client";
import { useState } from "react";
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
  SlidersHorizontal,
} from "lucide-react";
import type { ContentType, Entry, Locale, Publication } from "@/lib/types";
import { dateLabel, statusOf, titleOf } from "@/lib/utils";
import { Button } from "./ui/button";
export function ContentList({
  space,
  entries,
  types,
  publications,
}: {
  space: string;
  entries: Entry[];
  types: ContentType[];
  publications: Publication[];
}) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [status, setStatus] = useState(""),
    [locale, setLocale] = useState<Locale>("es"),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("updated");
  const filtered = entries
    .filter((e) => {
      const t = types.find((t) => t.id === e.content_type_id);
      return (
        t &&
        (!type || t.id === type) &&
        (!status || statusOf(e, t, publications, locale) === status) &&
        titleOf(e, t, locale).toLowerCase().includes(query.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? titleOf(
            a,
            types.find((t) => t.id === a.content_type_id),
            locale,
          ).localeCompare(
            titleOf(
              b,
              types.find((t) => t.id === b.content_type_id),
              locale,
            ),
          )
        : b.updated_at.localeCompare(a.updated_at),
    );
  const published = entries.filter((e) =>
    publications.some((p) => p.entry_id === e.id),
  ).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12)),
    current = Math.min(page, pageCount - 1);
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
                  href={`/spaces/${space}/content/new?type=${t.id}`}
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
              {entries.length}
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
              {published}
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
              {entries.length - published}
              <span>ideas en marcha</span>
            </strong>
          </div>
        </div>
      </div>
      <section className="content-panel">
        <div className="panel-title">
          <div>
            <h2>
              Todas las entradas <span className="count">{entries.length}</span>
            </h2>
            <p>Un buen contenido empieza con una buena idea.</p>
          </div>
          <div className="row">
            <span className="status-dot" />
            <small className="muted">Todo en su sitio</small>
          </div>
        </div>
        <div className="filters">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Buscar contenido"
              placeholder="Buscar por título…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Tipo de contenido"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos los modelos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos los estados</option>
            {["Borrador", "Publicado", "Cambios pendientes"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Idioma del listado"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value as Locale);
              setPage(0);
            }}
          >
            <option value="es">Español</option>
            <option value="gl">Galego</option>
          </select>
          <select
            aria-label="Ordenar"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated">Más recientes</option>
            <option value="name">Título A–Z</option>
          </select>
          <SlidersHorizontal size={16} className="filter-icon" />
        </div>
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
              {filtered.slice(current * 12, current * 12 + 12).map((e) => {
                const t = types.find((t) => t.id === e.content_type_id)!;
                const st = statusOf(e, t, publications, locale);
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/spaces/${space}/content/${e.id}`}
                        className="entry-title"
                      >
                        <span
                          className={`entry-icon ${t.key === "page" ? "violet" : "blue"}`}
                        >
                          <FileText size={17} />
                        </span>
                        <span>
                          <strong>{titleOf(e, t, locale)}</strong>
                          <small>
                            {String(
                              e.translations[locale]?.slug ??
                                e.shared.slug ??
                                "Sin slug",
                            )}
                          </small>
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
                        aria-label={`Editar ${titleOf(e, t, locale)}`}
                        className="table-arrow"
                        href={`/spaces/${space}/content/${e.id}`}
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
        {!filtered.length && (
          <div className="empty">
            <span className="empty-icon">
              <FileText size={27} />
            </span>
            <h3>
              {entries.length
                ? "No encontramos ese contenido"
                : "Tu próxima idea empieza aquí"}
            </h3>
            <p>
              {entries.length
                ? "Prueba con otro título o cambia los filtros."
                : "Crea tu primera entrada para darle forma."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {filtered.length
              ? `${current * 12 + 1}–${Math.min((current + 1) * 12, filtered.length)} de ${filtered.length} entradas`
              : "Sin entradas"}
          </span>
          <div className="row">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
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
