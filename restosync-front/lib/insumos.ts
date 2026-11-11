/**
 * Categorías e íconos de insumos compartidos por el front.
 * Espejo de la lógica del backend (InventarioService.iconoAutomatico) y de las
 * categorías que asigna la IA en restosync-ia, para que todo quede consistente.
 */

/** Categorías base (las mismas que usa la IA). */
export const CATEGORIAS_BASE = [
  'Almacén',
  'Lácteos',
  'Carnes',
  'Frutas y verduras',
  'Bebidas',
  'Panadería',
]

/**
 * Magnitudes profesionales de un restaurante (primer selector). Cada una ofrece sus
 * unidades de precisión (segundo selector) en notación estándar: Peso → kg/g/mg,
 * Volumen → l/ml, Unidades → contables. Fuente única para toda la app: para ampliar,
 * editar acá y reflejarlo en el prompt de `restosync-ia/main.py`. El backend guarda
 * `unidadMedida` como string libre con el SÍMBOLO (ej. 'kg'); el tipo se deriva.
 * Las unidades informales de envase (Docenas, Paquetes, Latas, Atados) se retiraron:
 * la migración `normalizarUnidadesMedida` del core las convierte al arrancar.
 */
export type TipoUnidad = 'Peso' | 'Volumen' | 'Unidades'

export const TIPOS_UNIDAD: TipoUnidad[] = ['Peso', 'Volumen', 'Unidades']

export const UNIDADES_POR_TIPO: Record<TipoUnidad, string[]> = {
  Peso: ['kg', 'g', 'mg'],
  Volumen: ['l', 'ml'],
  Unidades: ['unidad'],
}

/** Todas las unidades válidas, en el orden de sus tipos. */
export const UNIDADES_BASE: string[] = TIPOS_UNIDAD.flatMap((tipo) => UNIDADES_POR_TIPO[tipo])

const UNIDAD_POR_DEFECTO: Record<TipoUnidad, string> = {
  Peso: 'kg',
  Volumen: 'l',
  Unidades: 'unidad',
}

/** Magnitud a la que pertenece una unidad guardada; legacy/desconocida cae en Unidades. */
export function tipoDeUnidad(unidad: string | null | undefined): TipoUnidad {
  const limpia = (unidad ?? '').trim()
  return TIPOS_UNIDAD.find((tipo) => UNIDADES_POR_TIPO[tipo].includes(limpia)) ?? 'Unidades'
}

/** Unidad de precisión inicial al elegir una magnitud (kg / l / unidad). */
export function unidadPorDefecto(tipo: TipoUnidad): string {
  return UNIDAD_POR_DEFECTO[tipo]
}

// Nombre legacy capitalizado (antes de la migración del core) → símbolo actual.
const UNIDAD_LEGACY: Record<string, string> = {
  'kilos': 'kg', 'kilo': 'kg', 'kg': 'kg', 'kilogramos': 'kg',
  'gramos': 'g', 'gramo': 'g',
  'litros': 'l', 'litro': 'l',
  'unidades': 'unidad',
  'docenas': 'unidad', 'paquetes': 'unidad', 'latas': 'unidad', 'atados': 'unidad',
}

/** Normaliza unidades legacy a la notación actual para mostrarlas (pasa intactas las sanas). */
export function normalizarUnidad(unidad: string | null | undefined): string {
  const limpia = (unidad ?? '').trim()
  if (!limpia) return 'unidad'
  return UNIDAD_LEGACY[limpia.toLowerCase()] ?? limpia
}

// Símbolo → palabra entera para mostrar en pantalla. Solo display: el backend,
// los selects (value) y los payloads siguen usando el símbolo.
const ETIQUETAS_UNIDAD: Record<string, string> = {
  'kg': 'Kilos',
  'g': 'Gramos',
  'mg': 'Miligramos',
  'l': 'Litros',
  'ml': 'Mililitros',
  'unidad': 'Unidad',
}

/** Etiqueta legible de una unidad; normaliza legacy y deja intactas las desconocidas. */
export function etiquetaUnidad(unidad: string | null | undefined): string {
  const simbolo = normalizarUnidad(unidad)
  return ETIQUETAS_UNIDAD[simbolo] ?? simbolo
}

const ICONO_POR_CATEGORIA: Record<string, string> = {
  'Lácteos': '🥛',
  'Carnes': '🍗',
  'Frutas y verduras': '🥬',
  'Bebidas': '🥤',
  'Panadería': '🍞',
  'Almacén': '🫙',
}

// Palabras clave del nombre → emoji (tiene prioridad sobre la categoría).
const ICONOS_POR_NOMBRE: [string, string][] = [
  ['pollo', '🍗'], ['carne', '🥩'], ['cerdo', '🥓'], ['pescado', '🐟'], ['salmon', '🐟'],
  ['leche', '🥛'], ['queso', '🧀'], ['yogur', '🥛'], ['manteca', '🧈'], ['huevo', '🥚'],
  ['tomate', '🍅'], ['lechuga', '🥬'], ['cebolla', '🧅'], ['papa', '🥔'], ['zanahoria', '🥕'],
  ['banana', '🍌'], ['manzana', '🍎'], ['limon', '🍋'], ['naranja', '🍊'], ['palta', '🥑'],
  ['aceite', '🫙'], ['arroz', '🍚'], ['fideo', '🍝'], ['harina', '🌾'], ['pan', '🍞'],
  ['azucar', '🍬'], ['sal', '🧂'], ['cafe', '☕'], ['cerveza', '🍺'], ['vino', '🍷'],
  ['gaseosa', '🥤'], ['jugo', '🧃'], ['agua', '💧'],
]

/** Ícono automático: primero por nombre, luego por categoría; si no, 📦. */
export function iconoParaInsumo(nombre: string, categoria?: string | null): string {
  const n = nombre.toLowerCase()
  const porNombre = ICONOS_POR_NOMBRE.find(([clave]) => n.includes(clave))
  if (porNombre) return porNombre[1]
  return (categoria && ICONO_POR_CATEGORIA[categoria]) || '📦'
}