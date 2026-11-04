# 🍽️ RestoSync — Sistema de Gestión Integral para Gastronomía

RestoSync es una plataforma multimodular para la gestión operativa de restaurantes: inventario por
local con lotes y vencimientos, menú con recetas, preparación de platos con descuento FIFO de stock,
mapa visual de mesas y administración de cuentas, con un microservicio de IA para cargar compras
desde tickets. **El proyecto no implementa pagos ni cobros.**

## Módulos

| Módulo | Stack | Rol |
|---|---|---|
| `core-service` | Kotlin 2.1 · Spring Boot 4 · JPA · Spring Security · JWT | API de negocio (puerto **8080**) |
| `restosync-front` | Next.js 16 · React 19 · Tailwind 4 · TypeScript | Interfaz web (puerto **3000**) |
| `restosync-ia` | FastAPI · Gemini | Lectura de tickets de compra (puerto **8000**); guarda la `GEMINI_API_KEY` en su propio `.env` |
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
  reposición sugerida por stock mínimo y últimas preparaciones.

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

Todas las rutas (excepto register/login) requieren `Authorization: Bearer <token>`; el Admin además
envía `X-Local-Id` en las rutas con scope de local.

## Documentación del proyecto

- `Plan-General.md`: plan por fases, reglas de negocio y registro de correctivos.
- `proyecto.md`: enunciado original.