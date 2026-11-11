<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RestoSync front — convenciones del módulo

Convenciones generales del proyecto (idioma, alcance, verificación, parada de servicios):
[`../AGENTS.md`](../AGENTS.md). Este archivo aplica esas reglas al `app/` y agrega las propias.

## Estructura

App Router con una ruta por pantalla: `/` (landing pública), `/login`, `/register`,
`/dashboard` (Inicio), `/inventario`, `/menu`, `/mesas`, `/registro` (carga de compra con IA,
acepta `?modo=ticket` y `?modo=audio`), `/analitica` (métricas reales), `/prediccion` (monitor
predictivo), `/locales`, `/cuentas` (solo Admin), `/sistema` (estado de servicios y sesión; **no
recibe ninguna API key**). Componentes compartidos en `components/` (`app-header`,
`app-navigation`, `modal`, `confirm-dialog`, `selector-local`, `graficos/`) y lógica de datos en
`lib/` (`api.ts`, `use-auth-session.ts`, `prediccion.ts`, `insumos.ts`, `ia-mock.ts`,
`dictado.ts`, `numero.ts`).

## Sesión y autenticación

- **Toda pantalla autenticada empieza con `useAuthSession()`** y muestra el estado
  "Verificando sesión..." mientras `checking`; el hook ya redirige a `/login` si el token cayó
  (401 en `/me`). No crear un mecanismo de guarda alternativo.
- El token vive en `localStorage` **por decisión consciente**, con el riesgo aceptado. No migrar
  a cookies `httpOnly` sin rediseñar CORS, login y todas las pantallas autenticadas.

## Navegación

`AppHeader` recibe `activePage`, `rol`, `locales`, `localActivoId` y `onLocalChange`; la
navegación filtra los enlaces `adminOnly` por rol y agrupa Operación / Análisis / Administración.
Una ruta nueva se registra en `app-navigation.tsx` **y** en `app-header.tsx`; el tipo
`ActivePage` es la fuente de verdad de las páginas con icono propio.

## Comportamientos ya corregidos (no regress)

- El CRUD de insumos (`/inventario`) es **vía auxiliar de corrección**; la carga principal es
  `/registro` con IA. No rediseñar la UX de inventario como si la carga manual fuera el flujo
  principal.
- **No usar `window.confirm`**: todo borrado pasa por `components/confirm-dialog.tsx`. El
  `ConfirmDialog` de `/mesas` al liberar una mesa con platos es **informativo** ("los platos dejan de
  mostrarse; el historial se conserva"), no un pedido de permiso.
- **Los platos "actuales" de una mesa los decide el core**, no la UI: `/mesas` muestra lo que devuelve
  `GET /producciones?mesaId=` (ya filtrado por la ocupación en curso) y ni siquiera lo pide si la mesa
  seleccionada no está OCUPADA. El tipo `Mesa` trae `fechaOcupacion`.
- **Dictado (`/registro?modo=audio`)**: la transformación texto → ítems pasa por `lib/dictado.ts`
  (`procesarDictado`), que **nunca lanza**: mock → IA real → parser local con aviso en pantalla. No
  agregar ahí un `throw` ni un try/catch en la pantalla. La grabación usa Web Speech API con
  `continuous` + `interimResults`, la instancia vive en un `useRef` y **no se reinicia sola** en
  `onend` (loop de permisos de Chrome). El guardado manda la `unidadMedida` real del ítem (default
  `'unidad'`), no un valor fijo.
- **Ticket y dictado producen los mismos ítems (no regress)**: ambos pasan por
  `normalizarItemsCompra` de `lib/dictado.ts` (mismo contrato y misma regla de envase que
  `normalizar_items` de la IA): nombre limpio en sentence case y bultos × tamaño de envase →
  cantidad total en unidad de medida ("10 x Leche 1L" → Leche larga vida 10 `l`, no 10 unidades);
  `"unidad"` solo para contables sin medida. El parser local del dictado también entiende
  "10 leche de 1 litro" y "3 paquetes de arroz de 500 g". Si cambiás la regla de envase, cambiála
  en los dos lados (front e IA).
- **Unidades en dos niveles (no regress)**: la magnitud (`Peso`/`Volumen`/`Unidades`) y su precisión
  (`kg/g/mg`, `l/ml`, `unidad`) viven en `lib/insumos.ts` (`TIPOS_UNIDAD`, `UNIDADES_POR_TIPO`,
  `tipoDeUnidad`, `unidadPorDefecto`, `normalizarUnidad`). El backend guarda solo el símbolo en
  `unidadMedida`; el tipo se deriva. El display usa `etiquetaUnidad()` (palabra entera:
  Kilos/Gramos/Miligramos/Litros/Mililitros/Unidad); los `value` de los selects y los payloads
  siguen con el símbolo — no renderizar la unidad cruda. Alta/edición en `/inventario` y revisión
  en `/registro` usan
  **dos selectores** encadenados. Las unidades informales (Docenas, Paquetes, Latas, Atados) se
  retiraron: no reponerlas en la UI ni en los prompts de la IA (la migración `normalizarUnidadesMedida`
  del core convierte los datos viejos).
- **Nunca se renderiza una cantidad cruda**: toda `cantidad` / `stock` que llega del core o de la IA
  se muestra con `formatearCantidad` (y se normaliza con `redondearCantidad` al cargarla) desde
  `lib/numero.ts`. Sin eso aparecen ruidos de punto flotante como `9.200000000000003 Kilos`. No
  volver a escribir un formateador local en una pantalla (`/analitica` reexporta el compartido).
- En los modales, **no depender de `onClose` dentro de un `useEffect`** (ni meterlo en la lista
  de dependencias de efectos de foco): el foco se pierde mientras se tipea — bug ya corregido.
- Textos es-AR con voseo; labels de producto en inglés no van.

## Estética

Mantener el sistema de tokens `resto-*` (`resto-manteca`, `resto-ciruela`, `resto-oliva`,
`resto-dorado`, `resto-acero`) y las esquinas `rounded-[2rem]`. No introducir otra paleta ni otro
radio. Los gráficos usan **Recharts** (ya es dependencia; no agregar otra librería de charts).

## Verificación

```powershell
npx tsc --noEmit
npm run build        # con `npm run dev` detenido, para no chocar en .next/
```
