'use client';
import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { aiServiceUrl, apiUrl, authHeaders } from '@/lib/api';
import { useAuthSession } from '@/lib/use-auth-session';
import { escanearTicketMock, usarMockIa } from '@/lib/ia-mock';
import {
  CATEGORIAS_BASE,
  TIPOS_UNIDAD,
  UNIDADES_POR_TIPO,
  normalizarUnidad,
  tipoDeUnidad,
  unidadPorDefecto,
  type TipoUnidad,
} from '@/lib/insumos';
import { redondearCantidad } from '@/lib/numero';
import { procesarDictado, type ItemDictado } from '@/lib/dictado';

type SpeechRecognitionAlternative = { transcript: string };

/** Resultado de una frase: `isFinal` distingue lo confirmado del texto provisorio. */
type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type ProductoDetectado = {
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  /** Unidad real del ítem; la trae la IA, el mock o el parser local (§2.5). */
  unidadMedida: string;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
};

export default function RegistroClient() {
  const { token, checking, localActivoId } = useAuthSession();
  const searchParams = useSearchParams();
  const modo = searchParams.get('modo') || 'ticket';

  const [archivo, setArchivo] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [productos, setProductos] = useState<ProductoDetectado[]>([]);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorIa, setErrorIa] = useState('');

  const [grabando, setGrabando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  // Texto provisorio mientras se habla (resultados interinos, en gris).
  const [interim, setInterim] = useState('');
  const [procesandoDictado, setProcesandoDictado] = useState(false);
  // Aviso sutil del dictado (corte por silencio, uso del parser local): no es error.
  const [avisoDictado, setAvisoDictado] = useState('');

  // Instancia viva del reconocedor: la manipulan los botones empezar/terminar (§2.2).
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // True cuando el stop() lo pidió el usuario; evita el aviso de "se cortó sola".
  const paradaManualRef = useRef(false);

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
    setErrorIa('');

    try {
      if (usarMockIa()) {
        const data = await escanearTicketMock(archivo);
        setProductos(data.itemsEncontrados);
        return;
      }

      const formData = new FormData();
      formData.append('file', archivo);

      const response = await fetch(
        aiServiceUrl('/api/v1/ia/escanear-ticket'),
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || 'Error al procesar el ticket en el microservicio de IA'
        );
      }

      const data: { itemsEncontrados?: ProductoDetectado[] } =
        await response.json();
      setProductos(
        Array.isArray(data.itemsEncontrados)
          ? data.itemsEncontrados.map((item) => ({
              ...item,
              // Tickets: si Gemini no informó la unidad (o trajo una legacy), se normaliza (§2.5).
              unidadMedida: normalizarUnidad(item.unidadMedida),
            }))
          : []
      );

    } catch (error: unknown) {
      console.error(
        'Error de conexión con el servicio de IA:',
        error
      );

      // fetch lanza TypeError cuando el microservicio no responde (caído o sin CORS).
      setErrorIa(
        error instanceof TypeError
          ? 'No se pudo conectar con el microservicio de IA (puerto 8000). Verificá que restosync-ia esté corriendo.'
          : error instanceof Error
          ? error.message
          : 'No se pudo conectar con el microservicio de IA (Puerto 8000)'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DICTADO
  // =========================
  const iniciarGrabacion = () => {
    setMensajeExito('');
    setErrorIa('');
    setAvisoDictado('');

    const SpeechRecognition = (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorIa('Tu navegador no soporta reconocimiento de voz.');
      return;
    }

    paradaManualRef.current = false;
    setGrabando(true);

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'es-AR';
    // Grabación continua con resultado provisorio: acumula varias frases hasta
    // que el usuario presiona "Terminar de grabar" (§2.2).
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const nuevosInterinos: string[] = [];
      for (let i = event.results.length - 1; i >= 0; i--) {
        const resultado = event.results[i];
        // Solo los ítems confirmados por el motor se acumulan a la transcripción final.
        if (resultado.isFinal) {
          const texto = resultado[0].transcript.trim();
          if (texto) {
            setTranscripcion((actual) => (actual ? `${actual} ${texto}` : texto));
          }
        } else {
          nuevosInterinos.unshift(resultado[0].transcript);
        }
      }
      setInterim(nuevosInterinos.join(' ').trim());
    };

    recognition.onerror = (event: { error: string }) => {
      paradaManualRef.current = true; // El onend que sigue no debe mostrar el aviso de corte.
      setGrabando(false);
      setInterim('');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorIa('No pudimos acceder al micrófono. Revisá los permisos del navegador.');
      } else if (event.error === 'no-speech') {
        setErrorIa('No se escuchó nada. Probá de nuevo acercando el micrófono.');
      } else {
        setErrorIa('No pudimos interpretar el audio.');
      }
    };

    recognition.onend = () => {
      setGrabando(false);
      setInterim('');
      // Chrome corta la sesión por silencio prolongado: avisar, pero NO reiniciar
      // automáticamente (evita loops de permisos).
      if (!paradaManualRef.current) {
        setAvisoDictado('La grabación terminó. Podés volver a empezar.');
      }
    };

    recognition.start();
  };

  const terminarGrabacion = () => {
    paradaManualRef.current = true;
    setGrabando(false);
    recognitionRef.current?.stop();
  };

  // Transforma el texto acumulado en ítems de inventario (IA con fallback local, §2.4).
  const procesarDictadoARevision = async () => {
    const texto = transcripcion.trim();
    if (!texto || grabando || procesandoDictado) return;

    setProcesandoDictado(true);
    setErrorIa('');
    setAvisoDictado('');
    setMensajeExito('');

    try {
      const { items, fuente } = await procesarDictado(texto);

      if (items.length === 0) {
        setErrorIa('No pudimos interpretar el dictado. Corregí el texto y volvé a procesarlo.');
        return;
      }

      // Normalizamos acá para garantizar `unidadMedida` incluso con respuestas viejas.
      const nuevos: ProductoDetectado[] = items.map((item: ItemDictado) => ({
        ...item,
        unidadMedida: normalizarUnidad(item.unidadMedida),
      }));
      setProductos((actuales) => [...actuales, ...nuevos]);

      if (fuente === 'local') {
        setAvisoDictado(
          'La IA no estuvo disponible; interpretamos el texto localmente. Revisá los ítems.'
        );
      }

      setTranscripcion('');
      setInterim('');
    } finally {
      setProcesandoDictado(false);
    }
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
    if (!token) {
      return;
    }

    setGuardando(true);
    setMensajeExito('');
    setErrorIa('');

    try {
      for (const prod of productos) {
        const response = await fetch(apiUrl('/api/v1/insumos'), {
            method: 'POST',
            headers: authHeaders(token, localActivoId),
            body: JSON.stringify({
              nombre: prod.nombre,
              categoria: prod.categoria,
              icono: prod.icono,
              unidadMedida: normalizarUnidad(prod.unidadMedida),
              stockMinimo: 1,
              cantidad: redondearCantidad(prod.cantidad),
              diasRestantes: prod.diasRestantes,
              estado: prod.estado || 'Cerrado',
              vencimiento: `${prod.diasRestantes} días`,
            }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const detalle =
            (data && (data.message || data.error)) ||
            `HTTP ${response.status}`;
          throw new Error(
            `No se pudo guardar ${prod.nombre}: ${detalle}`
          );
        }

        setProductos((actuales) =>
          actuales.filter((producto) => producto !== prod)
        );
      }

      setMensajeExito(
        '¡Productos guardados con éxito en tu base de datos!'
      );

      setProductos([]);
      setArchivo(null);

    } catch (error: unknown) {
      console.error(
        'Error guardando en Spring Boot:',
        error
      );

      setErrorIa(
        error instanceof Error
          ? error.message
          : 'Hubo un error al guardar los insumos en el backend.'
      );
    } finally {
      setGuardando(false);
    }
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">

      {/* =========================
          NAVBAR
      ========================= */}
      <header className="border-b border-resto-ciruela/10 bg-resto-manteca">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          <Link href="/dashboard">
            <h1 className="text-2xl font-black tracking-tight">
              Resto<span className="text-resto-canela">Sync.</span>
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


        {/* ERROR DE IA (inline, reemplaza al alert nativo) */}
        {errorIa && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-resto-canela/30 bg-resto-dorado/10 px-4 py-3 text-sm text-resto-ciruela"
          >
            {errorIa}
          </div>
        )}


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
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setArchivo(e.dataTransfer.files[0]);
                    setMensajeExito('');
                  }
                }}
                className={`group block cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center focus-within:outline-none focus-within:ring-2 focus-within:ring-resto-oliva ${
                  isDragging
                    ? 'border-resto-oliva bg-resto-oliva/15 scale-[1.01]'
                    : 'border-resto-oliva/30 bg-resto-manteca/50 hover:bg-resto-oliva/5 hover:border-resto-oliva'
                }`}
              >

                <input
                  id="ticket"
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <div className="text-5xl mb-5 group-hover:scale-110 transition-transform">
                  {archivo ? '📄' : isDragging ? '📥' : '🧾'}
                </div>

                <h4 className="text-lg font-bold">
                  {archivo
                    ? archivo.name
                    : isDragging
                    ? '¡Soltá tu ticket acá!'
                    : 'Subí o arrastrá tu ticket o factura'}
                </h4>

                <p className="text-sm text-resto-acero mt-2">
                  Arrastrá el archivo acá o hacé clic para seleccionarlo
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
                Presioná &quot;Empezar a grabar&quot; y hablá naturalmente; podés dictar varias
                frases. Cuando termines, presioná &quot;Terminar de grabar&quot; y procesá el
                texto para convertir tu lista de compras en productos del inventario.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={iniciarGrabacion}
                  disabled={grabando || procesandoDictado}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-resto-dorado text-resto-ciruela font-black hover:bg-resto-manteca transition-all disabled:opacity-50"
                >
                  {grabando
                    ? '🎙️ Grabando...'
                    : '🎙️ Empezar a grabar'}
                </button>

                <button
                  type="button"
                  onClick={terminarGrabacion}
                  disabled={!grabando}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-resto-manteca/30 text-resto-manteca font-black hover:bg-resto-manteca/10 transition-all disabled:opacity-40"
                >
                  ⏹ Terminar de grabar
                </button>
              </div>

              {avisoDictado && (
                <p className="mt-4 text-sm text-resto-dorado" role="status">
                  {avisoDictado}
                </p>
              )}

              <textarea
                value={transcripcion}
                onChange={(event) => setTranscripcion(event.target.value)}
                rows={3}
                placeholder="El texto reconocido aparecerá aquí; puedes corregirlo."
                className="mt-6 w-full rounded-xl border border-resto-manteca/20 bg-resto-manteca p-3 text-left text-resto-ciruela"
                aria-label="Texto reconocido por dictado"
              />
              {interim && (
                <p className="mt-1 min-h-5 text-left text-sm italic text-resto-manteca/40" aria-live="polite">
                  {interim}
                </p>
              )}
              <p className="mt-2 text-sm text-resto-manteca/60">
                Al procesar, el dictado se transforma en un ítem por producto, con cantidad y
                unidad estimadas que podes revisar antes de guardar.
              </p>
              <button
                type="button"
                onClick={procesarDictadoARevision}
                disabled={!transcripcion.trim() || grabando || procesandoDictado}
                className="mt-4 rounded-xl bg-resto-oliva px-5 py-3 font-bold text-resto-manteca disabled:opacity-50"
              >
                {procesandoDictado
                  ? 'Procesando dictado...'
                  : 'Procesar dictado'}
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
          <div className="mt-8 rounded-2xl bg-resto-oliva/10 border border-resto-oliva/20 p-5" role="status">

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

                      <select
                        value={prod.categoria}
                        onChange={(e) =>
                          actualizarProducto(
                            index,
                            'categoria',
                            e.target.value
                          )
                        }
                        className="mt-2 rounded-lg border border-resto-ciruela/10 bg-resto-manteca px-2 py-1 text-xs text-resto-acero focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                      >
                        {Array.from(new Set([...CATEGORIAS_BASE, prod.categoria])).map((categoria) => (
                          <option key={categoria} value={categoria}>{categoria}</option>
                        ))}
                      </select>

                    </div>


                    {/* CANTIDAD + UNIDAD */}
                    <div className="w-full md:w-28">

                      <label className="text-[10px] uppercase tracking-wider font-bold text-resto-acero">
                        Cantidad
                      </label>

                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={redondearCantidad(prod.cantidad)}
                        onChange={(e) =>
                          actualizarProducto(
                            index,
                            'cantidad',
                            Number(e.target.value)
                          )
                        }
                        className="w-full mt-1 rounded-xl border border-resto-ciruela/10 bg-resto-manteca px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                      />

                      <label className="sr-only" htmlFor={`tipo-unidad-${index}`}>
                        Tipo de medida
                      </label>

                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <select
                          id={`tipo-unidad-${index}`}
                          value={tipoDeUnidad(prod.unidadMedida)}
                          onChange={(e) =>
                            actualizarProducto(
                              index,
                              'unidadMedida',
                              unidadPorDefecto(e.target.value as TipoUnidad)
                            )
                          }
                          className="w-full rounded-lg border border-resto-ciruela/10 bg-resto-manteca px-2 py-1 text-xs text-resto-acero focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                        >
                          {TIPOS_UNIDAD.map((tipo) => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>

                        <label className="sr-only" htmlFor={`unidad-${index}`}>
                          Unidad de medida
                        </label>

                        <select
                          id={`unidad-${index}`}
                          value={prod.unidadMedida || 'unidad'}
                          onChange={(e) =>
                            actualizarProducto(
                              index,
                              'unidadMedida',
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-resto-ciruela/10 bg-resto-manteca px-2 py-1 text-xs text-resto-acero focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                        >
                          {Array.from(new Set([
                            ...UNIDADES_POR_TIPO[tipoDeUnidad(prod.unidadMedida)],
                            prod.unidadMedida,
                          ])).filter(Boolean).map((unidad) => (
                            <option key={unidad} value={unidad}>{unidad}</option>
                          ))}
                        </select>
                      </div>

                    </div>


                    {/* VENCIMIENTO */}
                    <div className="w-full md:w-28">

                      <label className="text-[10px] uppercase tracking-wider font-bold text-resto-acero">
                        Vence en (días)
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={prod.diasRestantes}
                        onChange={(e) =>
                          actualizarProducto(
                            index,
                            'diasRestantes',
                            Number(e.target.value)
                          )
                        }
                        className="w-full mt-1 rounded-xl border border-resto-ciruela/10 bg-resto-manteca px-3 py-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                      />

                    </div>


                    {/* ELIMINAR */}
                    <button
                      type="button"
                      onClick={() =>
                        eliminarProducto(index)
                      }
                      className="w-10 h-10 shrink-0 rounded-xl text-resto-ciruela/40 hover:bg-resto-dorado/10 hover:text-resto-canela transition-colors"
                      title="Eliminar producto"
                      aria-label={`Quitar ${prod.nombre}`}
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
            className="text-xs font-semibold text-resto-oliva hover:text-resto-canela transition-colors"
          >
            Volver al inicio
          </Link>

        </div>

      </footer>

    </main>
  );
}
