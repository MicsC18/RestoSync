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
acepta `?modo=ticket`), `/analitica` (métricas reales), `/prediccion` (monitor predictivo),
`/locales`, `/cuentas` (solo Admin), `/sistema` (estado de servicios y sesión; **no recibe
ninguna API key**). Componentes compartidos en `components/` (`app-header`, `app-navigation`,
`modal`, `confirm-dialog`, `selector-local`, `graficos/`) y lógica de datos en `lib/` (`api.ts`,
`use-auth-session.ts`, `prediccion.ts`, `insumos.ts`, `ia-mock.ts`).

## Sesión y autenticación

- **Toda pantalla autenticada empieza con `useAuthSession()`** y muestra el estado
  "Verificando sesión..." mientras `checking`; el hook ya redirige a `/login` si el token cayó
  (401 en `/me`). No crear un mecanismo de guarda alternativo.
- El token vive en `localStorage` **por decisión consciente** y documentada (razones y riesgo
  aceptado en `Plan-Mejoras.md` §2.3). No migrar a cookies `httpOnly` sin rediseñar CORS, login
  y todas las pantallas autenticadas.

## Navegación

`AppHeader` recibe `activePage`, `rol`, `locales`, `localActivoId` y `onLocalChange`; la
navegación filtra los enlaces `adminOnly` por rol y agrupa Operación / Análisis / Administración.
Una ruta nueva se registra en `app-navigation.tsx` **y** en `app-header.tsx`; el tipo
`ActivePage` es la fuente de verdad de las páginas con icono propio.

## Comportamientos ya corregidos (no regress)

- El CRUD de insumos (`/inventario`) es **vía auxiliar de corrección**; la carga principal es
  `/registro` con IA. No rediseñar la UX de inventario como si la carga manual fuera el flujo
  principal.
- **No usar `window.confirm`**: todo borrado pasa por `components/confirm-dialog.tsx`.
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
