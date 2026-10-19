import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <header className="border-b border-resto-ciruela/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-2xl font-black tracking-tight">
            Resto<span className="text-resto-dorado">Sync.</span>
          </Link>
          <nav aria-label="Acceso" className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-resto-oliva/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-resto-oliva px-4 py-2 text-sm font-bold text-resto-manteca hover:bg-resto-ciruela focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
            >
              Registrar restaurante
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[75vh] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-resto-dorado/30 bg-resto-dorado/10 px-4 py-2 text-sm font-bold text-resto-ciruela">
            Plataforma gastronómica
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-tight md:text-7xl">
            Tu cocina, <span className="text-resto-oliva">sincronizada.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-resto-acero md:text-xl">
            Organiza el inventario de tu restaurante, registra compras y
            encuentra en un solo lugar la información que ayuda a cuidar cada
            ingrediente.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-resto-oliva px-6 py-4 font-bold text-resto-manteca shadow-lg shadow-resto-oliva/15 transition-colors hover:bg-resto-ciruela focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
            >
              Comenzar
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-resto-ciruela/15 px-6 py-4 font-bold transition-colors hover:bg-resto-ciruela/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
            >
              Ya tengo una cuenta
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] bg-resto-ciruela p-8 text-resto-manteca shadow-xl md:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-resto-dorado">
            Todo conectado
          </p>
          <div className="mt-7 space-y-4">
            <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-5">
              <p className="text-2xl">📦 Inventario</p>
              <p className="mt-2 text-sm text-resto-manteca/65">
                Consulta existencias y fechas de vencimiento.
              </p>
            </div>
            <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-5">
              <p className="text-2xl">🧾 Registro de compras</p>
              <p className="mt-2 text-sm text-resto-manteca/65">
                Carga compras con ayuda del escaneo de tickets.
              </p>
            </div>
            <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-5">
              <p className="text-2xl">📊 Analítica</p>
              <p className="mt-2 text-sm text-resto-manteca/65">
                Revisa información y sugerencias para tu restaurante.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-resto-ciruela/10 px-6 py-6 text-center text-sm text-resto-acero">
        © 2026 RestoSync. Gestión inteligente para tu cocina.
      </footer>
    </main>
  );
}
