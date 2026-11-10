# `restosync-front` — Interfaz web de RestoSync

Frontend en **Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript**. Consume la API del
`core-service` (puerto 8080) y llama **directo** al microservicio `restosync-ia` (puerto 8000): el
core no orquesta a la IA. Para el mapa general del proyecto, leé el [README de la raíz](../README.md).

## Cómo correr

```powershell
copy .env.example .env.local
npm install
npm run dev           # http://localhost:3000
```

`.env.local` tiene tres variables:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_API_URL` | base del `core-service` (`http://localhost:8080`) |
| `NEXT_PUBLIC_AI_SERVICE_URL` | base de `restosync-ia` (`http://localhost:8000`) |
| `NEXT_PUBLIC_USE_IA_MOCK` | `true` = el escaneo de tickets usa datos de ejemplo (no hace falta el puerto 8000); `false` (default) = llama a la IA real |

El backend necesita su perfil `local` antes de arrancar (ver README raíz, sección 1). No se
configura ninguna API key desde el navegador: la `GEMINI_API_KEY` vive solo en `restosync-ia/.env`.

## Rutas

| Ruta | Propósito |
|---|---|
| `/` | Landing pública (marketing), sin sesión |
| `/login` · `/register` | Acceso y alta de restaurantes |
| `/dashboard` | Inicio: resumen del local activo |
| `/inventario` | Insumos por local con lotes, vencimientos y CRUD correctivo |
| `/menu` | Platos y recetas; preparar plato descuenta stock FIFO |
| `/mesas` | Mapa visual (drag & drop), estados e historial de preparaciones |
| `/registro` | Carga principal: escaneo de ticket por IA y dictado por voz (`?modo=ticket` abre directo el escáner) |
| `/analitica` | Métricas reales del local (KPIs, categorías, reposición, últimas preparaciones) |
| `/prediccion` | Monitor predictivo: proyección de demanda, quiebres, mermas y compras (Recharts + insights IA) |
| `/locales` · `/cuentas` | Administración de locales y cuentas de gerentes (solo Admin) |
| `/sistema` | Estado de los servicios y datos de la sesión; no se configura nada |

La barra de navegación filtra opciones por rol: los grupos *Operación* y *Análisis* son comunes;
*Administración* solo aparece para `ADMIN_RESTAURANTE`.

## Verificación

```powershell
npx tsc --noEmit
npm run build         # detené npm run dev antes, para no chocar en .next/
```

## Convenciones

Las reglas de trabajo del módulo (guarda de sesión, tokens de estilo `resto-*`, textos es-AR,
por qué el token vive en `localStorage`, qué librerías no agregar) están en [`AGENTS.md`](./AGENTS.md).
