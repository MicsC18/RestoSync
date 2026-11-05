# 🍽️ RestoSync — Sistema de Gestión Integral para Gastronomía

RestoSync es una plataforma multimodular para la gestión operativa de restaurantes: inventario por
local con lotes y vencimientos, menú con recetas, preparación de platos con descuento FIFO de stock,
mapa visual de mesas y administración de cuentas, con un microservicio de IA para cargar compras
desde tickets y un monitor predictivo que proyecta la demanda de insumos. **El proyecto no
implementa pagos ni cobros.**

## Módulos

| Módulo | Stack | Rol |
|---|---|---|
| `core-service` | Kotlin 2.1 · Spring Boot 4 · JPA · Spring Security · JWT | API de negocio (puerto **8080**) |
| `restosync-front` | Next.js 16 · React 19 · Tailwind 4 · TypeScript | Interfaz web (puerto **3000**) |
| `restosync-ia` | FastAPI · Gemini · pandas | Lectura de tickets de compra y analítica predictiva de demanda (puerto **8000**); guarda la `GEMINI_API_KEY` en su propio `.env` |
| PostgreSQL (Neon) | Base en la nube | Persistencia |

## Requisitos

- **Java 21** (JDK)
- **Node.js 20+** y npm
- **Python 3.11+** solo si vas a usar el microservicio de IA real

## 1. Backend (`core-service`)

La conexión a PostgreSQL se toma de `src/main/resources/application.properties`. Podés sobrescribirla
con variables de entorno sin tocar el archivo:

```powershell
$env:DB_URL = "jdbc:postgresql://<host>/<db>?sslmode=require"
$env:DB_USERNAME = "<usuario>"
$env:DB_PASSWORD = "<contraseña>"
```

Levantar la API:

```powershell
cd core-service
.\gradlew.bat bootRun
```

- El esquema se actualiza solo al arrancar (`ddl-auto=update` + migraciones legacy en `initData`).
- En el primer arranque se siembra el restaurante demo **"La Farola"** con datos de prueba
  (idempotente: no pisa datos existentes ni cuentas reales):

| Cuenta demo | Contraseña | Rol |
|---|---|---|
| `admin@lafarola.com` | `123456` | Admin del restaurante (selector de local) |
| `gerente@lafarola.com` | `123456` | Gerente (entra directo a su local) |

  Además: 2 locales, 6 insumos con lote, 2 platos con receta y 5 mesas posicionadas.

### Tests

```powershell
cd core-service
.\gradlew.bat test
```

Tests unitarios sin base de datos (Mockito): roles y scope por local, preparar plato sin stock,
agrupado de filas homónimas en el descuento FIFO y ABM de gerentes (baja bloqueada con auditoría).

## 2. Frontend (`restosync-front`)

```powershell
cd restosync-front
copy .env.example .env.local
npm install
npm run dev
```

Variables en `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
# false (default) = la lectura de tickets llama al microservicio restosync-ia
# true = usa datos de ejemplo, sin levantar el puerto 8000 (solo para desarrollar)
NEXT_PUBLIC_USE_IA_MOCK=false
```

Con el flag en `true` el escaneo de tickets trae datos de ejemplo que después se confirman y
guardan de verdad; útil si no querés levantar `restosync-ia` mientras desarrollás.

## 3. Microservicio de IA (`restosync-ia`)

La lectura de tickets por IA usa este servicio: el navegador le envía el archivo directamente
(CORS ya habilitado para el front) y **la `GEMINI_API_KEY` vive únicamente en su `.env`**;
ningún otro módulo necesita configurar claves.

```powershell
cd restosync-ia
copy .env.example .env   # completar GEMINI_API_KEY
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verificá que respondió con `GET http://localhost:8000/` (devuelve `{"estado": "activo", ...}`).
Si preferís desarrollar sin el servicio, poné `NEXT_PUBLIC_USE_IA_MOCK=true` en el front y
reiniciá `npm run dev`.

### Monitor predictivo de demanda (`/analitica`)

Además del escaneo de tickets, `restosync-ia` expone la proyección de demanda que consume la
pantalla de Analítica. El **frontend es el punto de composición**: el core no orquesta a la IA y
la IA no toca la base de datos.

```
/analitica
  ├─ 1. GET  /api/v1/analitica/historial?dias=90   → core-service (JWT + X-Local-Id)
  ├─ 2. POST /api/v1/ia/prediccion-demanda          → restosync-ia (body: historial + horizonteDias)
  │        └─ pandas: demanda, mermas, compras ── Gemini (opcional): insights en texto natural
  └─ 3. Render: KPIs actuales + gráficos Recharts + recomendaciones (badge "Gemini" o "reglas")
```

- `GET /api/v1/analitica/historial` (core, solo lectura) agrega por local las series diarias de
  consumo/entradas/mermas, los insumos con sus lotes vigentes y las producciones de la ventana.
- `POST /api/v1/ia/prediccion-demanda` (IA) calcula con **pandas** la proyección de demanda, el
  quiebre de stock, las mermas en riesgo y las compras sugeridas; **Gemini solo redacta** las
  recomendaciones. Si no hay `GEMINI_API_KEY`, falla o se agota la cuota, el endpoint responde
  igual con `insights.fuente = "reglas"` (nunca devuelve `5xx` por un problema de Gemini).
- Con historial insuficiente (< 7 días de consumo) responde `datosInsuficientes: true` y el front
  muestra un estado vacío, no un error.
- En `/analitica` se puede cambiar el horizonte (7 / 14 / 30 días) y la proyección se recalcula
  sin volver a pedir el historial al core. Si el servicio de IA está caído, aparece un aviso con
  botón **Reintentar** y la analítica actual queda intacta.

## Funcionalidades

- **Multi-local con roles**: Admin opera todos los locales de su restaurante (header `X-Local-Id`);
  el Gerente queda fijo al local asignado en su token.
- **Inventario por local** con lotes y vencimientos: cargar un insumo existente con el **mismo
  vencimiento suma** al lote; con **otro vencimiento crea una fila nueva** (una por vencimiento).
  Las filas agotadas se ocultan por defecto (toggle "Agotados") pero se conservan por auditoría.
- **Carga por IA**: foto de ticket → el microservicio `restosync-ia` (Gemini) extrae los productos →
  revisión editable → guardado en el local activo. El mock queda como opción de desarrollo.
  También hay CRUD correctivo manual de insumos.
- **Menú y recetas**: platos por local con ingredientes; al **preparar** se descuenta stock
  agrupando las filas homónimas y consumiendo **FIFO por vencimiento**, con prevalidación de faltantes.
- **Mesas**: mapa visual con arrastrar y soltar (posiciones persistidas), estados
  Libre / Ocupada / Reservada e historial de preparaciones por mesa. Preparar un plato para una mesa
  la marca Ocupada.
- **Cuentas**: ABM de gerentes por el Admin (email único, contraseña BCrypt, reasignación de local).
  La baja se bloquea si la cuenta tiene movimientos o preparaciones registradas (auditoría).
- **Analítica**: conteos reales del local (stock, por vencer, menú, mesas), distribución por categoría,
  reposición sugerida por stock mínimo y últimas preparaciones. Sobre esa base, el **monitor
  predictivo** proyecta la demanda de cada insumo (gráficos Recharts con horizonte 7 / 14 / 30 días),
  anticipa quiebres de stock y mermas, sugiere compras por prioridad y muestra recomendaciones
  redactadas por Gemini o, si la IA no responde, por reglas de consumo.

## API principal (`/api/v1`)

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /me` |
| Insumos | `GET/POST /insumos` · `PUT/DELETE /insumos/{id}` · `GET /lotes?insumoId=` |
| Menú | `GET/POST /platos` · `PUT/DELETE /platos/{id}` · `POST /platos/{id}/preparar` |
| Producciones | `GET /producciones?mesaId=` |
| Mesas | `GET/POST /mesas` · `PUT/DELETE /mesas/{id}` |
| Locales | `GET/POST /locales` · `PUT/DELETE /locales/{id}` |
| Cuentas | `GET/POST /cuentas-gerentes` · `PUT/DELETE /cuentas-gerentes/{id}` |
| Analítica | `GET /analitica/historial?dias=` (historial agregado del local para el monitor predictivo) |

El microservicio de IA (`restosync-ia`, fuera del `/api/v1` del core) expone además
`POST /api/v1/ia/escanear-ticket` y `POST /api/v1/ia/prediccion-demanda`.

Todas las rutas (excepto register/login) requieren `Authorization: Bearer <token>`; el Admin además
envía `X-Local-Id` en las rutas con scope de local.

## Documentación del proyecto

- `proyecto.md`: enunciado original.