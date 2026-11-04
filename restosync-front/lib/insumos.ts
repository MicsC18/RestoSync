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