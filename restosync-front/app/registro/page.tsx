'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ProductoDetectado = {
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
};

export default function RegistroPage() {
  const searchParams = useSearchParams();
  const modo = searchParams.get('modo') || 'ticket';

  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [productos, setProductos] = useState<ProductoDetectado[]>([]);
  const [mensajeExito, setMensajeExito] = useState('');

  const [grabando, setGrabando] = useState(false);

  // =========================
  // SELECCIONAR ARCHIVO
  // =========================
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
      setMensajeExito('');
    }
  };

  // =========================
  // PROCESAR TICKET
  // =========================
  const procesarTicket = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!archivo) return;

    setLoading(true);
    setMensajeExito('');

    const formData = new FormData();
    formData.append('file', archivo);

    try {
      const response = await fetch(
        'http://localhost:8000/api/v1/ia/escanear-ticket',
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          'Error al procesar el ticket en el microservicio de IA'
        );
      }

      const data = await response.json();

      setProductos(data.itemsEncontrados || []);

    } catch (error) {
      console.error(
        'Error de conexión con Python:',
        error
      );

      alert(
        'No se pudo conectar con el microservicio de IA (Puerto 8000)'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DICTADO
  // =========================
  const handleDictado = () => {
    setMensajeExito('');

    if (!('webkitSpeechRecognition' in window)) {
      alert(
        'Tu navegador no soporta reconocimiento de voz.'
      );
      return;
    }

    setGrabando(true);

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();

    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript;

      console.log('Texto reconocido:', texto);

    
      setGrabando(false);

      alert(
        `Se detectó: "${texto}"\n\nEl procesamiento del dictado lo conectaremos con el microservicio de IA.`
      );
    };

    recognition.onerror = () => {
      setGrabando(false);
      alert('No pudimos interpretar el audio.');
    };

    recognition.onend = () => {
      setGrabando(false);
    };

    recognition.start();
  };

  // =========================
  // EDITAR PRODUCTO
  // =========================
  const actualizarProducto = (
    index: number,
    campo: keyof ProductoDetectado,
    valor: string | number
  ) => {
    setProductos((actuales) => {
      const nuevos = [...actuales];

      nuevos[index] = {
        ...nuevos[index],
        [campo]: valor,
      };

      return nuevos;
    });
  };

  // =========================
  // ELIMINAR PRODUCTO
  // =========================
  const eliminarProducto = (index: number) => {
    setProductos((actuales) =>
      actuales.filter((_, i) => i !== index)
    );
  };

  // =========================
  // GUARDAR EN SPRING BOOT
  // =========================
  const guardarEnBaseDeDatos = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/login';
      return;
    }

    setGuardando(true);
    setMensajeExito('');

    try {
      for (const prod of productos) {
        const response = await fetch(
          'http://localhost:8080/api/v1/insumos',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              nombre: prod.nombre,
              categoria: prod.categoria,
              icono: prod.icono,
              unidadMedida: 'Unidades',
              stockMinimo: 1,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `No se pudo guardar ${prod.nombre}`
          );
        }
      }

      setMensajeExito(
        '¡Productos guardados con éxito en tu base de datos!'
      );

      setProductos([]);
      setArchivo(null);

    } catch (error) {
      console.error(
        'Error guardando en Spring Boot:',
        error
      );

      alert(
        'Hubo un error al guardar los insumos en el backend.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">

      {/* =========================
          NAVBAR
      ========================= */}
      <header className="border-b border-resto-ciruela/10 bg-resto-manteca">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          <Link href="/dashboard">
            <h1 className="text-2xl font-black tracking-tight">
              Resto<span className="text-resto-dorado">Sync.</span>
            </h1>

            <p className="text-[10px] uppercase tracking-[0.2em] text-resto-acero">
              Tu cocina sincronizada
            </p>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-bold text-resto-ciruela hover:text-resto-oliva transition-colors"
          >
            ← Volver al panel
          </Link>

        </div>
      </header>


      {/* =========================
          CONTENIDO
      ========================= */}
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-10 md:py-14">

        {/* CABECERA */}
        <div className="max-w-2xl mb-10">

          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-resto-oliva">
            <span className="w-2 h-2 rounded-full bg-resto-oliva" />

            Registro rápido
          </span>

          <h2 className="text-4xl md:text-5xl font-black mt-3 leading-tight">
            {modo === 'ticket'
              ? 'Convertí tu ticket en inventario.'
              : 'Contanos qué compraste.'}
          </h2>

          <p className="text-resto-acero mt-4 text-base md:text-lg leading-relaxed">
            {modo === 'ticket'
              ? 'Subí una foto o PDF de tu compra y RestoSync identificará automáticamente los productos.'
              : 'Dictá los productos de tu compra y evitá cargarlos manualmente uno por uno.'}
          </p>

        </div>


        {/* =========================
            MODO TICKET
        ========================= */}
        {modo === 'ticket' && (
          <form onSubmit={procesarTicket}>

            <div className="rounded-[2rem] bg-white border border-resto-ciruela/10 p-6 md:p-8 shadow-sm">

              <div className="flex items-center gap-4 mb-7">

                <div className="w-14 h-14 rounded-2xl bg-resto-oliva/10 flex items-center justify-center text-3xl">
                  📷
                </div>

                <div>
                  <h3 className="text-xl font-black">
                    Escáner inteligente
                  </h3>

                  <p className="text-sm text-resto-acero mt-1">
                    La IA detectará los productos automáticamente.
                  </p>
                </div>

              </div>


              {/* INPUT ARCHIVO */}
              <label
                htmlFor="ticket"
                className="group block cursor-pointer rounded-2xl border-2 border-dashed border-resto-oliva/30 bg-resto-manteca/50 hover:bg-resto-oliva/5 hover:border-resto-oliva transition-all p-10 text-center"
              >

                <input
                  id="ticket"
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="text-5xl mb-5 group-hover:scale-110 transition-transform">
                  {archivo ? '📄' : '🧾'}
                </div>

                <h4 className="text-lg font-bold">
                  {archivo
                    ? archivo.name
                    : 'Subí tu ticket o factura'}
                </h4>

                <p className="text-sm text-resto-acero mt-2">
                  Hacé clic para seleccionar un archivo
                </p>

                <span className="inline-block mt-4 text-xs font-semibold text-resto-oliva">
                  PNG · JPG · PDF
                </span>

              </label>


              {/* BOTÓN */}
              <button
                type="submit"
                disabled={!archivo || loading}
                className="w-full mt-6 bg-resto-oliva text-resto-manteca py-4 rounded-xl font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Analizando ticket con IA...'
                  : 'Procesar con Inteligencia Artificial →'}
              </button>

            </div>

          </form>
        )}


        {/* =========================
            MODO AUDIO
        ========================= */}
        {modo === 'audio' && (
          <div className="rounded-[2rem] bg-resto-ciruela text-resto-manteca p-8 md:p-12 text-center relative overflow-hidden">

            <div className="relative z-10">

              <div className="w-24 h-24 mx-auto rounded-full bg-resto-dorado/15 border border-resto-dorado/30 flex items-center justify-center text-5xl mb-7">
                🎙️
              </div>

              <span className="text-xs uppercase tracking-[0.2em] font-bold text-resto-dorado">
                Dictado por voz
              </span>

              <h3 className="text-3xl md:text-4xl font-black mt-3">
                ¿Qué compraste hoy?
              </h3>

              <p className="max-w-lg mx-auto mt-4 text-resto-manteca/60 leading-relaxed">
                Presioná el botón y hablá naturalmente.
                RestoSync podrá transformar tu lista de compras
                en productos del inventario.
              </p>

              <button
                type="button"
                onClick={handleDictado}
                disabled={grabando}
                className="mt-8 px-8 py-4 rounded-2xl bg-resto-dorado text-resto-ciruela font-black hover:bg-resto-manteca transition-all disabled:opacity-50"
              >
                {grabando
                  ? '🎙️ Escuchando...'
                  : '🎙️ Dictar compra'}
              </button>

            </div>

            <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full border border-resto-dorado/10" />
            <div className="absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-resto-oliva/20" />

          </div>
        )}


        {/* =========================
            MENSAJE ÉXITO
        ========================= */}
        {mensajeExito && (
          <div className="mt-8 rounded-2xl bg-resto-oliva/10 border border-resto-oliva/20 p-5">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-full bg-resto-oliva text-resto-manteca flex items-center justify-center">
                ✓
              </div>

              <div>
                <p className="font-bold text-resto-oliva">
                  ¡Listo!
                </p>

                <p className="text-sm text-resto-acero">
                  {mensajeExito}
                </p>
              </div>

            </div>

          </div>
        )}


        {/* =========================
            PRODUCTOS DETECTADOS
        ========================= */}
        {productos.length > 0 && (
          <section className="mt-10">

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">

              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-resto-oliva">
                  Resultado de la IA
                </span>

                <h3 className="text-2xl md:text-3xl font-black mt-1">
                  Productos detectados
                </h3>
              </div>

              <span className="text-sm font-semibold text-resto-acero">
                {productos.length}{' '}
                {productos.length === 1
                  ? 'ítem encontrado'
                  : 'ítems encontrados'}
              </span>

            </div>


            {/* LISTA */}
            <div className="space-y-4">

              {productos.map((prod, index) => (

                <div
                  key={`${prod.nombre}-${index}`}
                  className="bg-white rounded-2xl border border-resto-ciruela/10 p-5 shadow-sm"
                >

                  <div className="flex flex-col md:flex-row md:items-center gap-4">

                    {/* ICONO */}
                    <div className="w-14 h-14 shrink-0 rounded-xl bg-resto-oliva/10 flex items-center justify-center text-3xl">
                      {prod.icono || '📦'}
                    </div>


                    {/* NOMBRE */}
                    <div className="flex-1">

                      <label className="text-[10px] uppercase tracking-wider font-bold text-resto-acero">
                        Producto
                      </label>

                      <input
                        type="text"
                        value={prod.nombre}
                        onChange={(e) =>
                          actualizarProducto(
                            index,
                            'nombre',
                            e.target.value
                          )
                        }
                        className="w-full mt-1 border-b border-resto-ciruela/10 bg-transparent py-1 font-bold text-resto-ciruela focus:outline-none focus:border-resto-oliva"
                      />

                      <p className="text-xs text-resto-acero mt-2">
                        {prod.categoria}
                      </p>

                    </div>


                    {/* CANTIDAD */}
                    <div className="w-full md:w-28">

                      <label className="text-[10px] uppercase tracking-wider font-bold text-resto-acero">
                        Cantidad
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={prod.cantidad}
                        onChange={(e) =>
                          actualizarProducto(
                            index,
                            'cantidad',
                            Number(e.target.value)
                          )
                        }
                        className="w-full mt-1 rounded-xl border border-resto-ciruela/10 bg-resto-manteca px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                      />

                    </div>


                    {/* VENCIMIENTO */}
                    <div className="text-left md:text-right md:min-w-[100px]">

                      <p className="text-[10px] uppercase tracking-wider font-bold text-resto-acero">
                        Vencimiento
                      </p>

                      <p className="font-bold mt-1">
                        {prod.diasRestantes} días
                      </p>

                    </div>


                    {/* ELIMINAR */}
                    <button
                      type="button"
                      onClick={() =>
                        eliminarProducto(index)
                      }
                      className="w-10 h-10 shrink-0 rounded-xl text-resto-ciruela/40 hover:bg-resto-dorado/10 hover:text-resto-dorado transition-colors"
                      title="Eliminar producto"
                    >
                      ×
                    </button>

                  </div>

                </div>

              ))}

            </div>


            {/* CONFIRMAR */}
            <div className="mt-6 rounded-2xl bg-resto-ciruela p-6 flex flex-col sm:flex-row items-center justify-between gap-5">

              <div>
                <p className="text-resto-manteca font-bold">
                  ¿Está todo correcto?
                </p>

                <p className="text-xs text-resto-manteca/50 mt-1">
                  Revisá los productos antes de guardarlos.
                </p>
              </div>

              <button
                type="button"
                onClick={guardarEnBaseDeDatos}
                disabled={guardando}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardando
                  ? 'Guardando...'
                  : '✓ Confirmar y guardar'}
              </button>

            </div>

          </section>
        )}

      </section>


      {/* =========================
          FOOTER
      ========================= */}
      <footer className="border-t border-resto-ciruela/10 mt-10">

        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">

          <p className="text-xs text-resto-acero">
            © 2026 RestoSync
          </p>

          <Link
            href="/dashboard"
            className="text-xs font-semibold text-resto-oliva hover:text-resto-dorado transition-colors"
          >
            Volver al inicio
          </Link>

        </div>

      </footer>

    </main>
  );
}
