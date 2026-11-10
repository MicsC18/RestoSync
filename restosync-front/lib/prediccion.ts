import { aiServiceUrl, apiUrl, authHeaders } from '@/lib/api';
import { prediccionDemandaMock, usarMockIa } from '@/lib/ia-mock';

// ---------- Tipos espejo del HistorialResponse del core (Plan-IA §1.1) ----------

export type LoteHistorial = {
  cantidad: number;
  fechaVencimiento: string; // yyyy-MM-dd
};

export type InsumoHistorial = {
  id: number;
  nombre: string;
  categoria: string | null;
  icono: string | null;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number | null;
  lotes: LoteHistorial[];
};

export type SerieDiaria = {
  fecha: string;
  insumoId: number;
  consumo: number;
  entradas: number;
  mermas: number;
};

export type ProduccionDiaria = {
  fecha: string;
  platoNombre: string;
  cantidad: number;
};

export type HistorialResponse = {
  localId: number;
  dias: number;
  desde: string;
  hasta: string;
  insumos: InsumoHistorial[];
  series: SerieDiaria[];
  producciones: ProduccionDiaria[];
};

// ---------- Tipos espejo de la PrediccionResponse de la IA (Plan-IA §1.2) ----------

export type PuntoProyeccion = {
  fecha: string;
  cantidad: number;
};

export type DemandaItem = {
  insumoId: number;
  nombre: string;
  icono: string | null;
  unidadMedida: string;
  consumoDiarioBase: number;
  proyeccion: PuntoProyeccion[];
  totalProyectado: number;
  stockActual: number;
  coberturaDias: number | null;
  fechaQuiebre: string | null;
};

export type MermaItem = {
  insumoId: number;
  nombre: string;
  icono: string | null;
  unidadMedida: string;
  cantidadEnRiesgo: number;
  fechaVencimiento: string;
};

export type PrioridadCompra = 'ALTA' | 'MEDIA' | 'BAJA';

export type CompraItem = {
  insumoId: number;
  nombre: string;
  icono: string | null;
  unidadMedida: string;
  cantidadSugerida: number;
  prioridad: PrioridadCompra;
  motivo: string;
};

export type Recomendacion = {
  titulo: string;
  detalle: string;
};

export type Insights = {
  fuente: 'gemini' | 'reglas';
  recomendaciones: Recomendacion[];
};

export type PrediccionResponse = {
  horizonteDias: number;
  generadoEn: string;
  datosInsuficientes: boolean;
  demanda: DemandaItem[];
  mermas: MermaItem[];
  compras: CompraItem[];
  insights: Insights;
};

// ---------- Llamadas a los servicios ----------

// Umbrales de espera: si el servicio no responde en tiempo, el fetch se aborta y la pantalla
// muestra el aviso correspondiente en vez de quedar colgada en el spinner (IA caída/colgada).
const TIMEOUT_HISTORIAL_MS = 15_000; // core-service
const TIMEOUT_PREDICCION_MS = 20_000; // IA: cubre el peor caso (Gemini timeout 15 s → fallback a reglas)

/** Pide el historial agregado al core-service (JWT + X-Local-Id, §1.1). */
export async function pedirHistorial(
  token: string,
  localId: number,
  dias = 90
): Promise<HistorialResponse> {
  const respuesta = await fetch(apiUrl(`/api/v1/analitica/historial?dias=${dias}`), {
    headers: authHeaders(token, localId),
    signal: AbortSignal.timeout(TIMEOUT_HISTORIAL_MS),
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el historial (${respuesta.status})`);
  }
  return (await respuesta.json()) as HistorialResponse;
}

/**
 * Envía el historial al microservicio de IA y devuelve la proyección (§1.2).
 * Con NEXT_PUBLIC_USE_IA_MOCK=true usa el mock local sin tocar el puerto 8000.
 * Si el servicio está caído o colgado, el timeout aborta el fetch y el llamador
 * (page.tsx) toma el catch → tarjeta "IA fuera de servicio" + Reintentar.
 */
export async function pedirPrediccion(
  historial: HistorialResponse,
  horizonteDias = 7
): Promise<PrediccionResponse> {
  if (usarMockIa()) {
    return prediccionDemandaMock(horizonteDias);
  }
  const respuesta = await fetch(aiServiceUrl('/api/v1/ia/prediccion-demanda'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historial, horizonteDias }),
    signal: AbortSignal.timeout(TIMEOUT_PREDICCION_MS),
  });
  if (!respuesta.ok) {
    throw new Error(`La IA no pudo proyectar la demanda (${respuesta.status})`);
  }
  return (await respuesta.json()) as PrediccionResponse;
}

// ---------- Utilidades compartidas por la pantalla y los gráficos ----------

export const PALETA_RESTO = ['#4A5D23', '#E0A96D', '#3A1124', '#54718E'] as const;

/** "2026-11-05" → "05/11" para el eje X. */
export function fechaDDMM(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** "2026-11-05" → "05/11/2026". */
export function fechaCompleta(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Días desde hoy hasta una fecha iso (negativo si ya pasó). */
export function diasHasta(iso: string): number {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const destino = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  const ms = destino.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return Math.round(ms / 86_400_000);
}
