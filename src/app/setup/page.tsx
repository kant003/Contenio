import { Layers3, ArrowRight, Database, ShieldCheck } from "lucide-react";
export default function Setup() {
  return (
    <main className="setup">
      <div className="brand">
        <span className="brand-mark">
          <Layers3 size={22} />
        </span>
        contenio<span className="tag">LOCAL</span>
      </div>
      <section className="setup-card">
        <span className="eyebrow">TU CONTENIDO, CONECTADO</span>
        <h1>
          Todo empieza
          <br />
          con un espacio.
        </h1>
        <p>
          El gestor está preparado para Neon Postgres integrado en Vercel.
          Conecta una base de datos o inicia el entorno local.
        </p>
        <div className="setup-step">
          <ShieldCheck />
          <div>
            <strong>1. Prepara el entorno local</strong>
            <code>npm run db:env</code>
          </div>
        </div>
        <div className="setup-step">
          <Database />
          <div>
            <strong>2. Inicia PostgreSQL</strong>
            <code>npm run db:start</code>
          </div>
        </div>
        <div className="setup-step">
          <Layers3 />
          <div>
            <strong>3. Prepara los datos de demostración</strong>
            <code>npm run db:migrate &amp;&amp; npm run db:seed</code>
          </div>
        </div>
        <a className="button button-primary" href="/login">
          Ir al inicio de sesión <ArrowRight size={16} />
        </a>
        <small>
          Docker debe estar en ejecución. Consulta README.md para conectar Neon
          y Blob en producción.
        </small>
      </section>
      <p className="setup-foot">
        Hecho para que crear contenido sea lo sencillo.
      </p>
    </main>
  );
}
