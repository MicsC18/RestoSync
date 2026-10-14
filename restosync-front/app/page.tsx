'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela overflow-hidden">

      {/* ========================================
          NAVBAR
      ======================================== */}
      <header className="sticky top-0 z-50 bg-resto-manteca/95 backdrop-blur-md border-b border-resto-ciruela/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="shrink-0">
            <h1 className="text-2xl font-black tracking-tight">
              Resto<span className="text-resto-dorado">Sync.</span>
            </h1>

            <p className="text-[10px] uppercase tracking-[0.2em] text-resto-acero">
              Tu cocina sincronizada
            </p>
          </Link>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#beneficios"
              className="text-sm font-medium text-resto-ciruela/75 hover:text-resto-oliva transition-colors"
            >
              Beneficios
            </a>

            <a
              href="#como-funciona"
              className="text-sm font-medium text-resto-ciruela/75 hover:text-resto-oliva transition-colors"
            >
              Cómo funciona
            </a>

            <a
              href="#por-que"
              className="text-sm font-medium text-resto-ciruela/75 hover:text-resto-oliva transition-colors"
            >
              ¿Por qué RestoSync?
            </a>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2.5 text-sm font-bold text-resto-ciruela hover:text-resto-oliva transition-colors"
            >
              Iniciar sesión
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-resto-oliva text-resto-manteca text-sm font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all duration-300"
            >
              <span>Empezar ahora</span>
              <span>→</span>
            </Link>
          </div>

        </div>
      </header>


      {/* ========================================
          HERO
      ======================================== */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 md:pt-24 md:pb-28 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12 items-center">

          {/* Texto */}
          <div className="relative z-10">

            <div className="inline-flex items-center gap-2 rounded-full border border-resto-oliva/20 bg-resto-oliva/5 px-4 py-2 mb-7">
              <span className="w-2 h-2 rounded-full bg-resto-oliva" />

              <span className="text-xs sm:text-sm font-semibold text-resto-oliva">
                Una forma más inteligente de cuidar tus alimentos
              </span>
            </div>

            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.08] tracking-tight">
              Tu cocina tiene
              <span className="block text-resto-oliva">
                más potencial.
              </span>
              <span className="block text-resto-dorado">
                Aprovechalo.
              </span>
            </h2>

            <p className="mt-7 max-w-xl text-base md:text-lg leading-relaxed text-resto-acero">
              ¿Te olvidás de lo que tenés en la heladera? ¿Comprás algo
              que ya estaba en la alacena? RestoSync te ayuda a organizar
              tus alimentos, anticiparte a los vencimientos y comprar
              con más inteligencia.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 mt-9">

              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all duration-300 shadow-lg shadow-resto-oliva/10"
              >
                Organizá tu cocina
                <span className="text-xl">→</span>
              </Link>

              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-resto-ciruela/15 text-resto-ciruela font-bold hover:bg-white transition-all duration-300"
              >
                Conocé cómo funciona
              </a>

            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8 text-sm text-resto-acero">

              <span className="flex items-center gap-2">
                <span className="text-resto-oliva">✓</span>
                Inventario organizado
              </span>

              <span className="flex items-center gap-2">
                <span className="text-resto-oliva">✓</span>
                Alertas de vencimiento
              </span>

            </div>

          </div>


          {/* Vista ilustrativa del producto */}
          <div className="relative">

            {/* Decoración */}
            <div className="absolute -top-12 -right-8 w-48 h-48 rounded-full bg-resto-dorado/15 blur-3xl" />
            <div className="absolute -bottom-10 -left-8 w-48 h-48 rounded-full bg-resto-oliva/10 blur-3xl" />

            <div className="relative rounded-[2rem] bg-resto-ciruela p-4 sm:p-6 shadow-2xl shadow-resto-ciruela/15">

              {/* Cabecera de la demo */}
              <div className="flex items-center justify-between px-2 sm:px-3 pt-2 pb-6">

                <div>
                  <p className="text-xs text-resto-manteca/50 uppercase tracking-[0.18em]">
                    Tu espacio
                  </p>

                  <h3 className="text-xl font-bold text-resto-manteca mt-1">
                    Mi cocina
                  </h3>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-resto-oliva/20 border border-resto-oliva/30 px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-resto-oliva" />

                  <span className="text-xs font-semibold text-resto-manteca">
                    Vista de ejemplo
                  </span>
                </div>

              </div>


              {/* Tarjeta de alerta */}
              <div className="rounded-2xl bg-resto-manteca p-5 sm:p-6">

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-resto-acero">
                      Atención a tus alimentos
                    </p>

                    <h4 className="text-2xl font-black mt-3">
                      No dejes que
                      <span className="block text-resto-dorado">
                        nada se pierda.
                      </span>
                    </h4>
                  </div>

                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-resto-dorado/15 flex items-center justify-center text-2xl">
                    🔔
                  </div>

                </div>

                <div className="mt-5 rounded-xl bg-resto-dorado/10 border border-resto-dorado/20 p-4 flex items-center gap-3">

                  <span className="text-2xl">⚠️</span>

                  <div>
                    <p className="font-bold text-sm">
                      Productos por revisar
                    </p>

                    <p className="text-xs text-resto-acero mt-1">
                      Consultá qué alimentos necesitan atención.
                    </p>
                  </div>

                </div>

                {/* Lista de ejemplo */}
                <div className="mt-6">

                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-bold">
                      Revisá primero
                    </h5>

                    <span className="text-xs text-resto-oliva font-semibold">
                      Lista ilustrativa
                    </span>
                  </div>

                  <div className="space-y-3">

                    <div className="flex items-center gap-3 p-3 rounded-xl border border-resto-ciruela/10">

                      <div className="w-11 h-11 rounded-xl bg-resto-dorado/15 flex items-center justify-center text-2xl">
                        🥛
                      </div>

                      <div className="flex-1">
                        <p className="font-bold text-sm">
                          Leche
                        </p>

                        <p className="text-xs text-resto-acero mt-1">
                          Lácteos
                        </p>
                      </div>

                      <span className="text-xs font-bold text-resto-dorado">
                        Revisar
                      </span>

                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl border border-resto-ciruela/10">

                      <div className="w-11 h-11 rounded-xl bg-resto-oliva/10 flex items-center justify-center text-2xl">
                        🥬
                      </div>

                      <div className="flex-1">
                        <p className="font-bold text-sm">
                          Verduras
                        </p>

                        <p className="text-xs text-resto-acero mt-1">
                          Frutas y verduras
                        </p>
                      </div>

                      <span className="text-xs font-bold text-resto-oliva">
                        En stock
                      </span>

                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl border border-resto-ciruela/10">

                      <div className="w-11 h-11 rounded-xl bg-resto-acero/10 flex items-center justify-center text-2xl">
                        🥚
                      </div>

                      <div className="flex-1">
                        <p className="font-bold text-sm">
                          Huevos
                        </p>

                        <p className="text-xs text-resto-acero mt-1">
                          Refrigerados
                        </p>
                      </div>

                      <span className="text-xs font-bold text-resto-oliva">
                        En stock
                      </span>

                    </div>

                  </div>

                </div>

              </div>


              {/* Pie visual */}
              <div className="flex items-center justify-between gap-4 px-2 sm:px-3 pt-5 pb-1">

                <p className="text-sm text-resto-manteca/60">
                  Menos olvidos. Más organización.
                </p>

                <span className="text-2xl">🌿</span>

              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ========================================
          FRANJA DE VALOR
      ======================================== */}
      <section className="border-y border-resto-ciruela/10 bg-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8">

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-resto-oliva/10 flex items-center justify-center text-2xl">
              🧠
            </div>

            <div>
              <h3 className="font-bold">
                Más organización
              </h3>

              <p className="text-sm text-resto-acero mt-1">
                Sabé qué tenés disponible.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-resto-dorado/15 flex items-center justify-center text-2xl">
              ⏰
            </div>

            <div>
              <h3 className="font-bold">
                Menos olvidos
              </h3>

              <p className="text-sm text-resto-acero mt-1">
                Prestá atención a los vencimientos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-resto-acero/10 flex items-center justify-center text-2xl">
              🛒
            </div>

            <div>
              <h3 className="font-bold">
                Compras conscientes
              </h3>

              <p className="text-sm text-resto-acero mt-1">
                Planificá según tu inventario.
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================
          PROBLEMA / POR QUÉ
      ======================================== */}
      <section
        id="por-que"
        className="max-w-7xl mx-auto px-6 lg:px-10 py-20 md:py-28"
      >

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Columna de texto */}
          <div>

            <span className="text-xs font-bold uppercase tracking-[0.2em] text-resto-oliva">
              El problema de todos los días
            </span>

            <h2 className="text-4xl md:text-5xl font-black leading-tight mt-4">
              Compramos,
              <span className="block text-resto-dorado">
                guardamos,
              </span>
              y a veces nos olvidamos.
            </h2>

            <p className="text-resto-acero leading-relaxed mt-6 max-w-xl">
              Entre las compras, la rutina y las comidas de cada día,
              es fácil perder de vista lo que quedó en la heladera
              o al fondo de la alacena. Eso puede traducirse en
              alimentos desaprovechados y compras innecesarias.
            </p>

            <p className="text-resto-ciruela font-semibold leading-relaxed mt-4 max-w-xl">
              RestoSync busca ayudarte a cambiar esa dinámica:
              registrar, organizar y consultar tus alimentos
              desde un solo lugar.
            </p>

          </div>


          {/* Tarjetas del problema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="rounded-3xl border border-resto-ciruela/10 bg-white p-6 sm:mt-10">

              <div className="text-4xl mb-5">
                🥦
              </div>

              <h3 className="text-lg font-black">
                ¿Qué había en la heladera?
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Consultá tu inventario antes de volver a comprar.
              </p>

            </div>


            <div className="rounded-3xl border border-resto-ciruela/10 bg-resto-oliva/5 p-6">

              <div className="text-4xl mb-5">
                📅
              </div>

              <h3 className="text-lg font-black">
                ¿Qué tengo que usar primero?
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Identificá los alimentos que requieren atención
                según su fecha de vencimiento.
              </p>

            </div>


            <div className="rounded-3xl border border-resto-ciruela/10 bg-resto-dorado/10 p-6 sm:col-span-2">

              <div className="flex items-start gap-4">

                <div className="text-4xl">
                  🛒
                </div>

                <div>
                  <h3 className="text-lg font-black">
                    ¿Necesito comprarlo otra vez?
                  </h3>

                  <p className="text-sm text-resto-acero leading-relaxed mt-2 max-w-lg">
                    Tener los productos registrados te ayuda a revisar
                    lo que ya hay en casa y planificar mejor tu próxima compra.
                  </p>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ========================================
          BENEFICIOS
      ======================================== */}
      <section
        id="beneficios"
        className="bg-white/50 border-y border-resto-ciruela/10"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 md:py-28">

          <div className="max-w-2xl mx-auto text-center mb-14">

            <span className="text-xs font-bold uppercase tracking-[0.2em] text-resto-oliva">
              Una cocina más inteligente
            </span>

            <h2 className="text-4xl md:text-5xl font-black mt-4 leading-tight">
              Todo lo que necesitás.
              <span className="block text-resto-dorado">
                Donde lo necesitás.
              </span>
            </h2>

            <p className="text-resto-acero leading-relaxed mt-5">
              Herramientas pensadas para que organizar tus alimentos
              requiera menos esfuerzo y te ayude a tomar mejores decisiones.
            </p>

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Beneficio 1 */}
            <article className="group rounded-3xl border border-resto-ciruela/10 bg-resto-manteca p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-resto-ciruela/5 transition-all duration-300">

              <div className="w-14 h-14 rounded-2xl bg-resto-oliva/10 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                📦
              </div>

              <h3 className="text-xl font-black mt-6">
                Inventario digital
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Registrá productos, cantidades, categorías y fechas
                para tener una visión más clara de tu cocina.
              </p>

            </article>


            {/* Beneficio 2 */}
            <article className="group rounded-3xl border border-resto-ciruela/10 bg-resto-manteca p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-resto-ciruela/5 transition-all duration-300">

              <div className="w-14 h-14 rounded-2xl bg-resto-dorado/15 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                🔔
              </div>

              <h3 className="text-xl font-black mt-6">
                Alertas de vencimiento
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Detectá qué alimentos están próximos a vencer
                y priorizá su uso.
              </p>

            </article>


            {/* Beneficio 3 */}
            <article className="group rounded-3xl border border-resto-ciruela/10 bg-resto-manteca p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-resto-ciruela/5 transition-all duration-300">

              <div className="w-14 h-14 rounded-2xl bg-resto-acero/10 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                🎙️
              </div>

              <h3 className="text-xl font-black mt-6">
                Carga simplificada
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Agilizá el registro mediante el dictado por voz
                o el escaneo de tickets de compra.
              </p>

            </article>


            {/* Beneficio 4 */}
            <article className="group rounded-3xl border border-resto-ciruela/10 bg-resto-manteca p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-resto-ciruela/5 transition-all duration-300">

              <div className="w-14 h-14 rounded-2xl bg-resto-oliva/10 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                📊
              </div>

              <h3 className="text-xl font-black mt-6">
                Información útil
              </h3>

              <p className="text-sm text-resto-acero leading-relaxed mt-3">
                Explorá patrones de consumo y recibí recomendaciones
                para planificar tus próximas comidas y compras.
              </p>

            </article>

          </div>

        </div>
      </section>


      {/* ========================================
          CÓMO FUNCIONA
      ======================================== */}
      <section
        id="como-funciona"
        className="max-w-7xl mx-auto px-6 lg:px-10 py-20 md:py-28"
      >

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* Encabezado */}
          <div>

            <span className="text-xs font-bold uppercase tracking-[0.2em] text-resto-oliva">
              Empezar es sencillo
            </span>

            <h2 className="text-4xl md:text-5xl font-black mt-4 leading-tight">
              De la compra
              <span className="block text-resto-dorado">
                a una cocina organizada.
              </span>
            </h2>

            <p className="text-resto-acero leading-relaxed mt-6 max-w-xl">
              Incorporá tus productos, consultá su estado y usá esa
              información para decidir qué cocinar o qué comprar.
              Todo a partir de un inventario que podés mantener actualizado.
            </p>

            <Link
              href="/register"
              className="inline-flex items-center gap-3 mt-8 bg-resto-oliva text-resto-manteca px-6 py-4 rounded-xl font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all"
            >
              Crear mi cuenta
              <span className="text-xl">→</span>
            </Link>

          </div>


          {/* Pasos */}
          <div className="relative">

            <div className="absolute left-7 top-8 bottom-8 w-px bg-resto-oliva/20" />

            <div className="space-y-5">

              {/* Paso 1 */}
              <article className="relative flex gap-5 rounded-2xl bg-white border border-resto-ciruela/10 p-5 sm:p-6">

                <div className="relative z-10 shrink-0 w-14 h-14 rounded-2xl bg-resto-oliva text-resto-manteca flex items-center justify-center text-xl font-black">
                  01
                </div>

                <div>
                  <h3 className="text-lg font-black">
                    Registrá tu compra
                  </h3>

                  <p className="text-sm text-resto-acero leading-relaxed mt-2">
                    Cargá los productos manualmente o utilizá las
                    opciones de audio y escaneo disponibles.
                  </p>
                </div>

              </article>


              {/* Paso 2 */}
              <article className="relative flex gap-5 rounded-2xl bg-white border border-resto-ciruela/10 p-5 sm:p-6">

                <div className="relative z-10 shrink-0 w-14 h-14 rounded-2xl bg-resto-dorado text-resto-ciruela flex items-center justify-center text-xl font-black">
                  02
                </div>

                <div>
                  <h3 className="text-lg font-black">
                    Organizá tu inventario
                  </h3>

                  <p className="text-sm text-resto-acero leading-relaxed mt-2">
                    Revisá cantidades, categorías, vencimientos
                    y el estado de tus productos.
                  </p>
                </div>

              </article>


              {/* Paso 3 */}
              <article className="relative flex gap-5 rounded-2xl bg-white border border-resto-ciruela/10 p-5 sm:p-6">

                <div className="relative z-10 shrink-0 w-14 h-14 rounded-2xl bg-resto-ciruela text-resto-manteca flex items-center justify-center text-xl font-black">
                  03
                </div>

                <div>
                  <h3 className="text-lg font-black">
                    Tomá mejores decisiones
                  </h3>

                  <p className="text-sm text-resto-acero leading-relaxed mt-2">
                    Priorizá los alimentos que requieren atención,
                    consultá tus hábitos y planificá las próximas compras.
                  </p>
                </div>

              </article>

            </div>

          </div>

        </div>
      </section>


      {/* ========================================
          CTA FINAL
      ======================================== */}
      <section className="px-6 lg:px-10 pb-20 md:pb-28">

        <div className="relative max-w-7xl mx-auto overflow-hidden rounded-[2rem] bg-resto-ciruela p-8 md:p-14 lg:p-16">

          {/* Decoración */}
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full border border-resto-dorado/20" />
          <div className="absolute -right-10 -bottom-36 w-72 h-72 rounded-full bg-resto-oliva/20" />

          <div className="relative z-10 max-w-3xl">

            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-resto-dorado">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Tu cocina, un poco más simple
            </span>

            <h2 className="text-4xl md:text-6xl font-black text-resto-manteca leading-tight mt-5">
              Empezá a aprovechar
              <span className="block text-resto-dorado">
                todo lo que tenés.
              </span>
            </h2>

            <p className="text-resto-manteca/65 text-base md:text-lg leading-relaxed mt-5 max-w-xl">
              Organizá tus alimentos, planificá tus compras y dale
              a cada producto la atención que necesita.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">

              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all"
              >
                Crear cuenta gratis
                <span className="text-xl">→</span>
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl border border-resto-manteca/20 text-resto-manteca font-bold hover:bg-resto-manteca/10 transition-all"
              >
                Ya tengo una cuenta
              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* ========================================
          FOOTER
      ======================================== */}
      <footer className="border-t border-resto-ciruela/10">

        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-5">

          <Link href="/" className="text-xl font-black tracking-tight">
            Resto<span className="text-resto-dorado">Sync.</span>
          </Link>

          <p className="text-sm text-resto-acero text-center">
            Una cocina mejor organizada empieza con pequeños cambios.
          </p>

          <div className="flex items-center gap-5 text-sm font-semibold">

            <Link
              href="/login"
              className="text-resto-ciruela hover:text-resto-oliva transition-colors"
            >
              Iniciar sesión
            </Link>

            <Link
              href="/register"
              className="text-resto-oliva hover:text-resto-dorado transition-colors"
            >
              Registrarme
            </Link>

          </div>

        </div>

        <div className="border-t border-resto-ciruela/5 py-4 text-center">
          <p className="text-xs text-resto-acero">
            © 2026 RestoSync. Todos los derechos reservados.
          </p>
        </div>

      </footer>

    </main>
  );
}