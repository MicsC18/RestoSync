import type {
  CompraItem,
  DemandaItem,
  MermaItem,
  PuntoProyeccion,
  PrediccionResponse,
} from '@/lib/prediccion';

export type ItemEscaneadoMock = {
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  /** Unidad real del ítem (Plan-Mesas-Dictado §2.5: el mock también la trae). */
  unidadMedida: string;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
};

export type RespuestaEscaneoMock = {
  itemsEncontrados: ItemEscaneadoMock[];
};

const ITEMS_EJEMPLO: ItemEscaneadoMock[] = [
  {
    nombre: 'Leche entera',
    categoria: 'Lácteos',
    icono: '🥛',
    cantidad: 2,
    unidadMedida: 'l',
    diasRestantes: 7,
    estado: 'Cerrado',
  },
  {
    nombre: 'Tomate perita',
    categoria: 'Frutas y verduras',
    icono: '🍅',
    cantidad: 6,
    unidadMedida: 'kg',
    diasRestantes: 4,
    estado: 'Cerrado',
  },
  {
    nombre: 'Aceite de girasol',
    categoria: 'Almacén',
    icono: '🫙',
    cantidad: 1,
    unidadMedida: 'l',
    diasRestantes: 120,
    estado: 'Cerrado',
  },
  {
    nombre: 'Pechuga de pollo',
    categoria: 'Carnes',
    icono: '🍗',
    cantidad: 3,
    unidadMedida: 'kg',
    diasRestantes: 3,
    estado: 'Cerrado',
  },
];

/** Simula el escaneo de ticket sin llamar a restosync-ia. */
export async function escanearTicketMock(
  _archivo?: File | null
): Promise<RespuestaEscaneoMock> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { itemsEncontrados: ITEMS_EJEMPLO.map((item) => ({ ...item })) };
}

/**
 * El camino principal es el microservicio restosync-ia (tiene la GEMINI_API_KEY en su .env).
 * El mock solo se activa con el flag explícito NEXT_PUBLIC_USE_IA_MOCK=true,
 * para desarrollar sin levantar el puerto 8000.
 */
export function usarMockIa(): boolean {
  return process.env.NEXT_PUBLIC_USE_IA_MOCK === 'true';
}

// ---------- Mock del monitor predictivo (Plan-IA §4.1) ----------

function isoLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Proyección con patrón semanal: vi/sáb ×1.6, dom ×1.3 (coherente con el seed del core). */
function proyeccionMock(base: number, horizonte: number): PuntoProyeccion[] {
  const puntos: PuntoProyeccion[] = [];
  const hoy = new Date();
  for (let i = 1; i <= horizonte; i++) {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const numeroDeSemana = dia.getDay(); // 0 = domingo
    const factor = numeroDeSemana === 5 || numeroDeSemana === 6 ? 1.6 : numeroDeSemana === 0 ? 1.3 : 1;
    puntos.push({
      fecha: isoLocal(dia),
      cantidad: Math.round(base * factor * 100) / 100,
    });
  }
  return puntos;
}

function quiebreMock(proyeccion: PuntoProyeccion[], stock: number): string | null {
  let acumulado = 0;
  for (const punto of proyeccion) {
    acumulado += punto.cantidad;
    if (acumulado > stock) return punto.fecha;
  }
  return null;
}

/**
 * Simula POST /api/v1/ia/prediccion-demanda sin levantar restosync-ia.
 * Tres insumos con patrón semanal, una merma y dos compras sugeridas.
 */
export async function prediccionDemandaMock(
  horizonteDias = 7
): Promise<PrediccionResponse> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const especificaciones = [
    { insumoId: 101, nombre: 'Mozzarella', icono: '🧀', unidadMedida: 'kg', base: 3.4, stock: 2.1, minimo: 2 },
    { insumoId: 102, nombre: 'Harina 000', icono: '🌾', unidadMedida: 'kg', base: 6.2, stock: 12.5, minimo: 5 },
    { insumoId: 103, nombre: 'Tomate perita', icono: '🍅', unidadMedida: 'kg', base: 2.1, stock: 18, minimo: 4 },
  ];

  const demanda: DemandaItem[] = especificaciones
    .map((esp) => {
      const proyeccion = proyeccionMock(esp.base, horizonteDias);
      const total = Math.round(proyeccion.reduce((suma, p) => suma + p.cantidad, 0) * 100) / 100;
      return {
        ...esp,
        consumoDiarioBase: esp.base,
        proyeccion,
        totalProyectado: total,
        stockActual: esp.stock,
        coberturaDias: Math.round((esp.stock / esp.base) * 10) / 10,
        fechaQuiebre: quiebreMock(proyeccion, esp.stock),
      };
    })
    .sort((a, b) => b.totalProyectado - a.totalProyectado);

  const hoy = new Date();
  const venceEnTres = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 3));
  const mermas: MermaItem[] = [
    {
      insumoId: 101,
      nombre: 'Mozzarella',
      icono: '🧀',
      unidadMedida: 'kg',
      cantidadEnRiesgo: 1.2,
      fechaVencimiento: venceEnTres,
    },
  ];

  const compras: CompraItem[] = ['ALTA', 'MEDIA'].map((prioridad, indice) => {
    const item = indice === 0 ? demanda.find((d) => d.fechaQuiebre) ?? demanda[0] : demanda[1];
    const minimo = especificaciones.find((esp) => esp.insumoId === item.insumoId)?.minimo ?? 0;
    // Misma fórmula que el motor de la IA: ceil(totalProyectado + stockMinimo − stockActual)
    const sugerida = Math.max(1, Math.ceil(item.totalProyectado + minimo - item.stockActual));
    return {
      insumoId: item.insumoId,
      nombre: item.nombre,
      icono: item.icono,
      unidadMedida: item.unidadMedida,
      cantidadSugerida: sugerida,
      prioridad: prioridad as CompraItem['prioridad'],
      motivo:
        indice === 0
          ? `Cobertura de ${item.coberturaDias} días: el stock se agota durante el horizonte proyectado.`
          : `Cobertura de ${item.coberturaDias} días: conviene reponer antes de los ${horizonteDias} días proyectados.`,
    };
  });

  return {
    horizonteDias,
    generadoEn: new Date().toISOString(),
    datosInsuficientes: false,
    demanda,
    mermas,
    compras,
    insights: {
      fuente: 'reglas',
      recomendaciones: [
        {
          titulo: 'Reponé mozzarella hoy mismo',
          detalle: 'La cobertura es de menos de un día y el stock quiebra dentro del horizonte. Priorizá la compra de mozzarella.',
        },
        {
          titulo: 'Usá la mozzarella del lote que vence el viernes',
          detalle: 'Hay 1.2 kg en riesgo de merma porque vencen antes de consumirse. Girá ese lote a las pizzas del día.',
        },
        {
          titulo: 'Aprovechá el pico de vi/sáb',
          detalle: 'La demanda proyectada crece un 60% viernes y sábados: comprá harina extra antes del jueves.',
        },
      ],
    },
  };
}
