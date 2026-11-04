'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PALETA_RESTO, fechaDDMM, type DemandaItem } from '@/lib/prediccion';

const MAX_INSUMOS = 5;

type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  payload?: Record<string, unknown>;
  value?: string | number;
};

/**
 * Proyección de demanda (Plan-IA §4.2): una línea por insumo seleccionado,
 * default top 5 por totalProyectado, eje X en dd/MM y tooltip con unidad.
 */
export default function DemandaChart({ demanda }: { demanda: DemandaItem[] }) {
  const [seleccion, setSeleccion] = useState<number[]>([]);

  // Al llegar una predicción nueva (o cambiar de local), arrancamos con el top 5.
  useEffect(() => {
    setSeleccion(demanda.slice(0, MAX_INSUMOS).map((d) => d.insumoId));
  }, [demanda]);

  const visibles = demanda.filter((d) => seleccion.includes(d.insumoId));

  const datos = useMemo(() => {
    const porFecha = new Map<string, Record<string, string | number>>();
    for (const item of visibles) {
      for (const punto of item.proyeccion) {
        const fila = porFecha.get(punto.fecha) ?? { fecha: punto.fecha };
        fila[`insumo-${item.insumoId}`] = punto.cantidad;
        fila[`unidad-${item.insumoId}`] = item.unidadMedida;
        porFecha.set(punto.fecha, fila);
      }
    }
    return [...porFecha.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [visibles]);

  const alternar = (insumoId: number) => {
    setSeleccion((prev) => {
      if (prev.includes(insumoId)) return prev.filter((s) => s !== insumoId);
      // Máximo 5 líneas: si está lleno, entra el nuevo reemplazando al más antiguo.
      if (prev.length >= MAX_INSUMOS) return [...prev.slice(1), insumoId];
      return [...prev, insumoId];
    });
  };

  const unidades = new Map(visibles.map((d) => [`insumo-${d.insumoId}`, d.unidadMedida] as const));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {demanda.map((item) => {
          const activo = seleccion.includes(item.insumoId);
          return (
            <button
              key={item.insumoId}
              type="button"
              onClick={() => alternar(item.insumoId)}
              aria-pressed={activo}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                activo
                  ? 'bg-resto-ciruela text-resto-manteca border-resto-ciruela'
                  : 'bg-white text-resto-acero border-resto-ciruela/15 hover:border-resto-ciruela/40'
              }`}
            >
              {item.icono ?? '📦'} {item.nombre}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-resto-acero py-10 text-center">
          Elegí al menos un insumo arriba para ver la proyección.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3A11241A" />
            <XAxis
              dataKey="fecha"
              tickFormatter={fechaDDMM}
              tick={{ fontSize: 12, fill: '#7393B3' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#7393B3' }} />
            <Tooltip
              content={
                <DemandaTooltip
                  nombres={new Map(visibles.map((d) => [`insumo-${d.insumoId}`, d.nombre] as const))}
                  unidades={unidades}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {visibles.map((item, indice) => (
              <Line
                key={item.insumoId}
                type="monotone"
                dataKey={`insumo-${item.insumoId}`}
                name={`${item.icono ?? ''} ${item.nombre}`.trim()}
                stroke={PALETA_RESTO[indice % PALETA_RESTO.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function DemandaTooltip({
  active,
  payload,
  label,
  nombres,
  unidades,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipItem[];
  nombres: Map<string, string>;
  unidades: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-resto-ciruela/15 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-black mb-1.5">{typeof label === 'string' ? fechaDDMM(label) : label}</p>
      {payload.map((entrada) => {
        const clave = String(entrada.dataKey ?? '');
        const nombre = nombres.get(clave) ?? String(entrada.name ?? clave);
        const unidad = unidades.get(clave) ?? '';
        return (
          <p key={clave} className="text-resto-acero font-bold">
            {nombre}: <span className="text-resto-ciruela">{entrada.value}</span> {unidad}
          </p>
        );
      })}
    </div>
  );
}
