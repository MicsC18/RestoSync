/**
 * Dictado por voz → ítems de insumos.
 *
 * Flujo híbrido: primero intenta con el microservicio de IA
 * (`POST /api/v1/ia/dictar-insumos` en restosync-ia); si el servicio no está,
 * devuelve 5xx o el JSON viene roto, cae al parser local heurístico — puro y
 * sin dependencias de red — y el front avisa qué camino se usó.
 */

import { aiServiceUrl } from '@/lib/api';
import { escanearTicketMock, usarMockIa } from '@/lib/ia-mock';
import { iconoParaInsumo, normalizarUnidad } from '@/lib/insumos';

/** Ítem de insumo resultante del dictado (contrato compartido con la IA y el guardado). */
export type ItemDictado = {
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  unidadMedida: string;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
};

/** Cómo se obtuvo la transformación: con IA o interpretando el texto localmente. */
export type FuenteDictado = 'ia' | 'local';

type ItemsBrutos = { itemsEncontrados?: unknown };

/**
 * Completa un ítem crudo (de la IA, del mock o del parser) con los defaults del
 * contrato, para que la revisión y el guardado siempre tengan todas las claves.
 */
export function normalizarItemsDictado(items: unknown): ItemDictado[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !!(item as Record<string, unknown>).nombre
    )
    .map((item) => ({
      nombre: String(item.nombre).trim(),
      categoria: (item.categoria as string) || 'Almacén',
      icono: (item.icono as string) || iconoParaInsumo(String(item.nombre), (item.categoria as string) || 'Almacén'),
      cantidad: typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : 1,
      unidadMedida: normalizarUnidad((item.unidadMedida as string) || 'unidad'),
      diasRestantes: typeof item.diasRestantes === 'number' && item.diasRestantes >= 0 ? item.diasRestantes : 30,
      estado: item.estado === 'Abierto' ? 'Abierto' : 'Cerrado',
    }));
}

/**
 * Transformación híbrida del texto dictado.
 * Nunca lanza: cualquier falla de la IA deriva al parseo local.
 */
export async function procesarDictado(
  texto: string
): Promise<{ items: ItemDictado[]; fuente: FuenteDictado }> {
  const limpio = texto.trim();

  if (usarMockIa()) {
    // Sin IA real de desarrollo: reusar los ítems de ejemplo del ticket (les sobra cualquier texto).
    const mock = await escanearTicketMock();
    return { items: normalizarItemsDictado(mock.itemsEncontrados), fuente: 'ia' };
  }

  try {
    const response = await fetch(aiServiceUrl('/api/v1/ia/dictar-insumos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: limpio }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: ItemsBrutos = await response.json();
    return { items: normalizarItemsDictado(data.itemsEncontrados), fuente: 'ia' };
  } catch {
    // Red, 5xx o JSON inválido: el parser local se hace cargo y el UI lo avisa.
    return { items: parseoLocalDictado(limpio), fuente: 'local' };
  }
}

// ---------- Parser local heurístico (fallback sin IA) ----------

// Numerales en español → número, aplicados fragmento por fragmento.
// "par" vale 2; "docena" se trata aparte porque además equivale a 12 unidades.
const NUMERALES: [RegExp, string][] = [
  [/\buno\b/i, '1'],
  [/\bpar\b/i, '2'],
  [/\bdos\b/i, '2'],
  [/\btres\b/i, '3'],
  [/\bcuatro\b/i, '4'],
  [/\bcinco\b/i, '5'],
  [/\bseis\b/i, '6'],
  [/\bsiete\b/i, '7'],
  [/\bocho\b/i, '8'],
  [/\bnueve\b/i, '9'],
  [/\bdiez\b/i, '10'],
  [/\bdoce\b/i, '12'],
];

// Patrón cantidad+unidad al inicio: el número puede ser dígito o palabra ("dos kilos de
// tomates", "2 kg papas" no requiere "de", "un par de facturas"). No usar \b luego de la
// unidad: con optional en el número, el backtracking necesita empezar en la unidad.
const CANTIDAD_UNIDAD =
  /^(\d+(?:[.,]\d+)?|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|medi[oa]|par)?\s*(kilos?|kg|litros?|docenas?|paquetes?|latas?|atados?|par)\s+de\s+/i;

// Unidad suelta sin número delante ("docena de huevos" → 12 unidad).
const UNIDAD_SUELTA: [RegExp, number, string][] = [
  [/\bdocenas?\b/i, 12, 'unidad'],
];

// Unidades reconocidas en cualquier parte del fragmento → símbolo de `unidadMedida`.
// Los envases (paquete/lata/atado) se cuentan como unidades: la notación profesional
// solo distingue peso (kg/g/mg), volumen (l/ml) y contables (unidad).
const UNIDADES: [RegExp, string][] = [
  [/\bkilos?\b|\bkg\b/i, 'kg'],
  [/\blitros?\b/i, 'l'],
  [/\bdocenas?\b/i, 'unidad'],
  [/\bpaquetes?\b/i, 'unidad'],
  [/\blatas?\b/i, 'unidad'],
  [/\batados?\b/i, 'unidad'],
];

// Ruido conversacional típico de un dictado: si el fragmento arranca con una de
// estas palabras (sin acentos) y no tiene cantidad ni unidad, no es un producto.
const RUIDO_INICIAL =
  /^(hola|como estas|estas|gracias|por favor|adios|bye|bien|ok|vale|listo|buenas|creo|quizas|manana|ayer|hoy)\b/;

// Verbos de compra que pueden encabezar el primer fragmento ("compré harina").
const VERBO_INICIAL = /^(compre|compra|comamos|necesitamos|necesito|falta|faltan|agrega|agregar)\b\s*/i;

// Palabras de relleno al inicio de un fragmento ("de tomates", "la harina").
const RELLENO_INICIAL = /^(?:de|del|la|el|los|las|con|y|o|un|una|e)\b[\s']*/i;

/**
 * Extrae productos del texto dictado sin IA. Casos de referencia:
 *  - "dos kilos de tomates y tres litros de leche"
 *      → Tomates 2 kg + Leche 3 l (divide por " y ", detecta cantidad+unidad)
 *  - "un chorizo" → Chorizo 1 unidad
 *  - "docena de huevos" → Huevos 12 unidad
 *  - "2 kg de papas, medio litro de aceite" → Papas 2 kg + Aceite 0.5 l
 *  - "compré harina, levadura luego azúcar" → tres ítems (divide por "," y " luego ")
 *  - texto de conversación ("hola cómo estás") → lista vacía → el UI muestra el error.
 * Es una heurística conservadora: nunca inventa ítems, y lo que devuelve igual se revisa.
 */
export function parseoLocalDictado(texto: string): ItemDictado[] {
  // Primero divide, después interpreta: así "una docena" no se rompe por el "un[ao]".
  const fragmentos = texto
    .toLowerCase()
    .split(/\s+(?:y|luego|despu\u00e9s|despues)\s+|,/);

  const items: ItemDictado[] = [];
  for (const bruto of fragmentos) {
    let fragmento = bruto.trim().replace(/\s+/g, ' ');
    if (!fragmento) continue;

    // Sin cantidad ni unidad explícitas, descarta ruido conversacional conocido.
    const tienePista = /\d|kilo|kg|litro|docena|paquete|lata|atado|medio|media|\bpar\b|uno/.test(fragmento);
    if (!tienePista && RUIDO_INICIAL.test(fragmento)) continue;

    fragmento = fragmento.replace(VERBO_INICIAL, '').trim();
    if (!fragmento) continue;

    let cantidad: number | null = null;
    let unidadMedida = 'unidad';

    // 1) Cantidad + unidad al inicio seguidas de "de" (o pegadas al nombre).
    const matchUnidad = fragmento.match(CANTIDAD_UNIDAD);
    if (matchUnidad) {
      const numero = matchUnidad[1];
      // "un/una" antes de una unidad real es artículo, no cantidad: deja decidir al mapa.
      cantidad = /^un/.test(numero ?? '') ? null : parsearNumero(numero ?? '');
      const unidadCruda = matchUnidad[2].toLowerCase();
      if (/^doc/.test(unidadCruda)) {
        // "una docena" = 12 unidades; "dos docenas" = 24.
        unidadMedida = 'unidad';
        cantidad = (cantidad ?? 1) * 12;
      } else if (/^par$/.test(unidadCruda)) {
        // "un par de" = 2; si el usuario dictó otro número lo respetamos.
        unidadMedida = 'unidad';
        cantidad = cantidad ?? 2;
      } else if (/^k/.test(unidadCruda)) unidadMedida = 'kg';
      else if (/^lit/.test(unidadCruda)) unidadMedida = 'l';
      else if (/^(lat|pac|at)/.test(unidadCruda)) unidadMedida = 'unidad';
      fragmento = fragmento.slice(matchUnidad[0].length);
    } else {
      // 2) Unidad suelta sin número delante ("docena de medialunas").
      for (const [patron, valor, unidad] of UNIDAD_SUELTA) {
        if (patron.test(fragmento)) {
          unidadMedida = unidad;
          cantidad = valor;
          fragmento = fragmento.replace(patron, ' ');
          break;
        }
      }
      // 3) Número suelto al inicio ("2 papas", "3 latas"…):
      if (cantidad === null) {
        const matchNumero = fragmento.match(/^(\d+(?:[.,]\d+)?|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|medio|media|par)\b\s*/);
        if (matchNumero) {
          cantidad = parsearNumero(matchNumero[1]);
          fragmento = fragmento.slice(matchNumero[0].length);
        }
      }
      // 4) Unidad sin "de" después del número ("dos tomates kilos" no, pero "kilos tomates" sí):
      if (unidadMedida === 'unidad') {
        for (const [patron, unidad] of UNIDADES) {
          if (patron.test(fragmento)) {
            unidadMedida = unidad;
            fragmento = fragmento.replace(patron, ' ');
            break;
          }
        }
      }
    }

    // Nombre: quitar relleno al inicio y capitalizar.
    let nombre = fragmento.trim();
    while (RELLENO_INICIAL.test(nombre)) {
      nombre = nombre.replace(RELLENO_INICIAL, '').trim();
    }
    nombre = nombre.replace(/\s+/g, ' ').trim();
    if (!/[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/i.test(nombre)) continue;
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);

    const categoria = 'Almacén';
    items.push({
      nombre,
      categoria,
      icono: iconoParaInsumo(nombre, categoria),
      cantidad: cantidad ?? 1,
      unidadMedida,
      diasRestantes: 30,
      estado: 'Cerrado',
    });
  }

  return items;
}

/** Number word/dígito → número, con "medio/media" = 0.5, "par" = 2 y "un/una" = 1. */
function parsearNumero(token: string): number | null {
  if (!token) return null;
  if (/^\d/.test(token)) return Number(token.replace(',', '.'));
  if (/^medi/.test(token)) return 0.5;
  if (/^par$/.test(token)) return 2;
  if (/^un/.test(token)) return 1;
  for (const [patron, valor] of NUMERALES) {
    if (patron.test(token)) return Number(valor);
  }
  return null;
}
