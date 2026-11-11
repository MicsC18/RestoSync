/**
 * Compras (dictado por voz o ticket) → ítems de insumos.
 *
 * El dictado tiene flujo híbrido: primero intenta con el microservicio de IA
 * (`POST /api/v1/ia/dictar-insumos` en restosync-ia); si el servicio no está,
 * devuelve 5xx o el JSON viene roto, cae al parser local heurístico — puro y
 * sin dependencias de red — y el front avisa qué camino se usó.
 *
 * `normalizarItemsCompra` es el contrato compartido con el ticket: mismas
 * claves, mismos defaults y misma regla de envase que `normalizar_items` de
 * restosync-ia/main.py, para que la misma compra produzca los mismos ítems
 * venga del camino que venga.
 */

import { aiServiceUrl } from '@/lib/api';
import { escanearTicketMock, usarMockIa } from '@/lib/ia-mock';
import { iconoParaInsumo } from '@/lib/insumos';

/** Ítem de insumo de una compra (contrato compartido por ticket, dictado, IA y guardado). */
export type ItemCompra = {
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
 * La usan por igual el dictado y el ticket: misma compra, mismos ítems.
 */
export function normalizarItemsCompra(items: unknown): ItemCompra[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !!(item as Record<string, unknown>).nombre
    )
    .map((item) => {
      const categoria = (item.categoria as string) || 'Almacén';
      const cantidad = typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : 1;
      const unidad = SIMBOLOS_UNIDAD[String(item.unidadMedida ?? 'unidad').trim().toLowerCase()] ?? 'unidad';
      const base = aplicarEnvase(String(item.nombre).trim(), cantidad, unidad);
      // Misma capitalización que el parser local (sentence case).
      const nombre = base.nombre.charAt(0).toUpperCase() + base.nombre.slice(1).toLowerCase();
      const estado: ItemCompra['estado'] = item.estado === 'Abierto' ? 'Abierto' : 'Cerrado';
      return {
        nombre,
        categoria,
        icono: (item.icono as string) || iconoParaInsumo(nombre, categoria),
        cantidad: base.cantidad,
        unidadMedida: base.unidadMedida,
        diasRestantes: typeof item.diasRestantes === 'number' && item.diasRestantes >= 0 ? item.diasRestantes : 30,
        estado,
      };
    })
    .filter((item) => item.nombre.length > 0);
}

/**
 * Transformación híbrida del texto dictado.
 * Nunca lanza: cualquier falla de la IA deriva al parseo local.
 */
export async function procesarDictado(
  texto: string
): Promise<{ items: ItemCompra[]; fuente: FuenteDictado }> {
  const limpio = texto.trim();

  if (usarMockIa()) {
    // Sin IA real de desarrollo: reusar los ítems de ejemplo del ticket (les sobra cualquier texto).
    const mock = await escanearTicketMock();
    return { items: normalizarItemsCompra(mock.itemsEncontrados), fuente: 'ia' };
  }

  try {
    const response = await fetch(aiServiceUrl('/api/v1/ia/dictar-insumos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: limpio }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: ItemsBrutos = await response.json();
    return { items: normalizarItemsCompra(data.itemsEncontrados), fuente: 'ia' };
  } catch {
    // Red, 5xx o JSON inválido: el parser local se hace cargo y el UI lo avisa.
    return { items: parseoLocalDictado(limpio), fuente: 'local' };
  }
}

// ---------- Regla de envase compartida con la IA (main.py) ----------

// Palabra de unidad → símbolo profesional (mismo mapa que SIMBOLOS_UNIDAD de la IA).
const SIMBOLOS_UNIDAD: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramos: 'kg',
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  mg: 'mg', miligramo: 'mg', miligramos: 'mg',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cc: 'ml', mililitro: 'ml', mililitros: 'ml',
  unidad: 'unidad', unidades: 'unidad',
  docena: 'unidad', docenas: 'unidad', paquete: 'unidad', paquetes: 'unidad',
  lata: 'unidad', latas: 'unidad', atado: 'unidad', atados: 'unidad',
};

// Tamaño de envase dentro del nombre ("Leche 1L", "Arroz de 500 g"): número + unidad.
// Alternativas de más larga a más corta para que mg/ml no se confundan con g/l.
const ENVASE = /(?:\bde\s+)?\b(\d+(?:[.,]\d+)?)\s*(miligramos?|mg|mililitros?|ml|cc|kilos?|kg|gramos?|gr|g|litros?|lt|l)\b/i;

/**
 * Pasa el tamaño de envase que quedó en el nombre a cantidad/unidad.
 * Con "unidad" (contable) multiplica bultos × tamaño; si ya venía en unidad de
 * medida, la cantidad ya es el total y solo se limpia el nombre.
 */
export function aplicarEnvase(
  nombre: string,
  cantidad: number,
  unidad: string
): { nombre: string; cantidad: number; unidadMedida: string } {
  let limpio = nombre.trim().replace(/^\d+\s*x\s+/i, '');
  const coincidencia = limpio.match(ENVASE);
  if (coincidencia && coincidencia.index !== undefined) {
    const tamano = Number(coincidencia[1].replace(',', '.'));
    const simbolo = SIMBOLOS_UNIDAD[coincidencia[2].toLowerCase()] ?? 'unidad';
    if (unidad === 'unidad' && simbolo !== 'unidad') {
      cantidad = Math.round(cantidad * tamano * 1000) / 1000;
      unidad = simbolo;
    }
    limpio = limpio.slice(0, coincidencia.index) + limpio.slice(coincidencia.index + coincidencia[0].length);
    limpio = limpio.trim().replace(/\s+(?:de|x)\s*$/i, '');
  }
  return { nombre: limpio.replace(/\s+/g, ' ').trim(), cantidad, unidadMedida: unidad };
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
  [/\bmiligramos?\b|\bmg\b/i, 'mg'],
  [/\bgramos?\b|\bg\b/i, 'g'],
  [/\bmililitros?\b|\bml\b|\bcc\b/i, 'ml'],
  [/\blitros?\b|\bl\b/i, 'l'],
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
// Lookahead en vez de \b: sin el flag u, \b no reconoce la "é" como letra.
const VERBO_INICIAL = /^(compr[eé]|compra|comamos|necesitamos|necesito|falta|faltan|agrega|agregar)(?=\s|$)\s*/i;

// Palabras de relleno al inicio de un fragmento ("de tomates", "la harina").
const RELLENO_INICIAL = /^(?:de|del|la|el|los|las|con|y|o|un|una|e)\b[\s']*/i;

/**
 * Extrae productos del texto dictado sin IA. Casos de referencia:
 *  - "dos kilos de tomates y tres litros de leche"
 *      → Tomates 2 kg + Leche 3 l (divide por " y ", detecta cantidad+unidad)
 *  - "un chorizo" → Chorizo 1 unidad
 *  - "docena de huevos" → Huevos 12 unidad
 *  - "2 kg de papas, medio litro de aceite" → Papas 2 kg + Aceite 0.5 l
 *  - "10 leche larga vida de 1 litro" → Leche larga vida 10 l (bultos × tamaño)
 *  - "3 paquetes de arroz de 500 g" → Arroz 1500 g
 *  - "compré harina, levadura luego azúcar" → tres ítems (divide por "," y " luego ")
 *  - texto de conversación ("hola cómo estás") → lista vacía → el UI muestra el error.
 * Es una heurística conservadora: nunca inventa ítems, y lo que devuelve igual se revisa.
 */
export function parseoLocalDictado(texto: string): ItemCompra[] {
  // Primero divide, después interpreta: así "una docena" no se rompe por el "un[ao]".
  const fragmentos = texto
    .toLowerCase()
    .split(/\s+(?:y|luego|despu\u00e9s|despues)\s+|,/);

  const items: ItemCompra[] = [];
  for (const bruto of fragmentos) {
    let fragmento = bruto.trim().replace(/\s+/g, ' ');
    if (!fragmento) continue;

    // Sin cantidad ni unidad explícitas, descarta ruido conversacional conocido.
    const tienePista = /\d|kilo|kg|litro|gramo|miligramo|mililitro|docena|paquete|lata|atado|medio|media|\bpar\b|uno|\bml\b|\bmg\b|\bcc\b/.test(fragmento);
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
    }

    // 4) Tamaño de envase ("10 leche de 1 litro", "3 paquetes de arroz de 500 g"):
    //    bultos × tamaño en la unidad del envase; el tamaño sale del nombre.
    //    Va fuera del if/else: aplica a los dos caminos de cantidad inicial.
    const envase = fragmento.match(ENVASE);
    if (envase && envase.index !== undefined) {
      const tamano = Number(envase[1].replace(',', '.'));
      const simbolo = SIMBOLOS_UNIDAD[envase[2].toLowerCase()] ?? 'unidad';
      if (simbolo !== 'unidad') {
        cantidad = Math.round((cantidad ?? 1) * tamano * 1000) / 1000;
        unidadMedida = simbolo;
        fragmento = fragmento.slice(0, envase.index) + fragmento.slice(envase.index + envase[0].length);
      }
    }
    // 5) Unidad sin "de" después del número ("dos tomates kilos" no, pero "kilos tomates" sí):
    if (unidadMedida === 'unidad') {
      for (const [patron, unidad] of UNIDADES) {
        if (patron.test(fragmento)) {
          unidadMedida = unidad;
          fragmento = fragmento.replace(patron, ' ');
          break;
        }
      }
    }

    // Nombre: quitar relleno al inicio y capitalizar.
    let nombre = fragmento.trim();
    while (RELLENO_INICIAL.test(nombre)) {
      nombre = nombre.replace(RELLENO_INICIAL, '').trim();
    }
    nombre = nombre.replace(/\s+(?:de|x)\s*$/i, '').replace(/\s+/g, ' ').trim();
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
