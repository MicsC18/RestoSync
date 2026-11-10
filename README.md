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

## Guía rápida (5 pasos)

Instalar y correr RestoSync sin conocer el proyecto: seguí los pasos **en orden**, copiá los
comandos tal cual (están escritos para **PowerShell** de Windows) y chequeá el "tenés que ver" de
cada paso antes de pasar al siguiente. Necesitás las ventanas del paso 3 y del paso 4 abiertas al
mismo tiempo mientras usás la app.

### Paso 1 — Bajar el repo y revisar las herramientas

```powershell
git clone https://github.com/MicsC18/RestoSync.git
cd RestoSync
java -version
node -v
```

**Tenés que ver:** un `openjdk version "21...` y un `node` `v20...` o mayor. Si falta alguno,
instalalo (Java 21 JDK y Node 20+) y arrancá de nuevo este paso.

### Paso 2 — Credenciales de la base (se hace una sola vez)

El backend necesita conectarse a PostgreSQL (Neon) y una clave propia para firmar sesiones. No
están en el repo a propósito: **pedile a quien ya tenga el proyecto** la cadena de conexión, el
usuario y la contraseña de la base (también salen de la página *Connection details* de tu database
en la consola de Neon).

```powershell
notepad core-service\src\main\resources\application-local.properties
```

Si el archivo no existe, Notepad pregunta si querés crearlo: **Sí**. Pegá estas cuatro líneas y
completá los valores (el `.secret` puede ser cualquier texto de 32 caracteres o más, tuyo):

```properties
spring.datasource.url=jdbc:postgresql://<host>/<db>?sslmode=require
spring.datasource.username=<usuario>
spring.datasource.password=<contrasena>
restosync.jwt.secret=<una-cadena-larga-de-al-menos-32-caracteres>
```

Guardá y cerrá Notepad. **Tenés que ver:** el archivo creado en esa carpeta (no se sube a Git,
está ignorado).

### Paso 3 — Levantar el backend

```powershell
cd core-service
$env:SPRING_PROFILES_ACTIVE = "local"
.\gradlew.bat bootRun
```

El primer arranque tarda 1–2 minutos (baja dependencias y crea la base de prueba).
**Tenés que ver** al final, en esta misma ventana:

```
Tomcat started on port(s): 8080
Started CoreServiceApplication in ... seconds
```

Con eso el backend **ya quedó corriendo**: no cierres la ventana, abrí una **nueva ventana** de
PowerShell y entrá de nuevo a la carpeta del repo (`cd RestoSync`) para el paso 4.

- Si aparece `Could not resolve placeholder 'DB_URL'` → el archivo del paso 2 no está en esa
carpeta o tiene un nombre distinto.
- Si aparece un error sobre la clave JWT → `restosync.jwt.secret` tiene menos de 32 caracteres.

### Paso 4 — Levantar la interfaz y entrar

En la ventana nueva:

```powershell
cd restosync-front
copy .env.example .env.local
npm install
npm run dev
```

**Tenés que ver:** un `Local: http://localhost:3000`. Abrí esa dirección en el navegador, iniciá
sesión con la cuenta demo que se crea sola en el primer arranque del backend:

| Usuario | Contraseña |
|---|---|
| `admin@lafarola.com` | `123456` |

Listo: Inventario, Menú, Mesas, Locales y Analítica ya funcionan con los datos de prueba
(restaurante "La Farola", 2 locales, 6 insumos, 2 platos, 5 mesas).

### Paso 5 — La IA (opcional, solo para tickets / dictado / predicción)

**Opción A — sin IA real (recomendada para probar rápido).** No instalás nada: en
`restosync-front\.env.local` cambiá la última línea por `NEXT_PUBLIC_USE_IA_MOCK=true`, pará el
frente con `Ctrl+C` y volvé a correr `npm run dev`. El escaneo de tickets y el dictado traen datos
de ejemplo que después se guardan de verdad.

**Opción B — IA real (necesita Python 3.11+ y una `GEMINI_API_KEY`).** En una tercera ventana:

```powershell
cd restosync-ia
copy .env.example .env
notepad .env                      # pegar la GEMINI_API_KEY y guardar
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Tenés que ver:** `Uvicorn running on http://127.0.0.1:8000`. Chequeá en el navegador
http://localhost:8000/ → `{"estado": "activo", ...}`. Con el frente apuntando a `http://localhost:8000`
(flag en `false`, como viene por defecto) ya anda el ticket, el dictado y el monitor predictivo.

### Para cerrar

`Ctrl+C` en cada ventana (frontend, backend y, si lo levantaste, la IA). No queda nada corriendo
de fondo.

### Si algo no anda

| Síntoma | Causa y arreglo |
|---|---|
| `Port 8080 was already in use` | Ya tenés un backend corriendo en otra ventana: cerrá esa ventana vieja y repetí el paso 3. |
| El login falla o las pantallas dicen "No pudimos cargar los datos" | El backend del paso 3 no está arriba (o recién arrancando): mirá esa ventana y recargá. |
| `No se pudo conectar con el microservicio de IA (puerto 8000)` | No levantaste la opción B: subí el servicio o poné `NEXT_PUBLIC_USE_IA_MOCK=true` (opción A). |
| Sacaste un `git pull` / cambiaste de rama | Volvé a correr el paso 3 y, si el frente trae cambios, `npm install` en el paso 4. |

---

## Detalle por módulo (referencia)

Lo que sigue explica la configuración, las pruebas y los endpoints de cada módulo; la guía rápida
de arriba ya alcanza para tener la app corriendo.

## 1. Backend (`core-service`)

### 1.1 Configurar las credenciales (obligatorio)

`src/main/resources/application.properties` **ya no contiene ninguna credencial**: solo define de
dónde se leen. Para levantar el backend hace falta crear el perfil local, que no se versiona:

```powershell
cd core-service\src\main\resources
notepad application-local.properties   # crearlo con los valores de la tabla de abajo
```

| Clave | Valor |
|---|---|
| `spring.datasource.url` | cadena de conexión de Neon (la que figura en el proyecto de la consola de Neon) |
| `spring.datasource.username` | rol de la base |
| `spring.datasource.password` | contraseña del rol |
| `restosync.jwt.secret` | cualquier cadena de **32 bytes o más** |

Ese archivo está ignorado por `src/main/resources/.gitignore`, así que **no puede commitearse**.
Si clonaste el repo desde cero, pedile las credenciales a quien ya tenga el perfil: no están en
GitHub a propósito.

### 1.2 Levantar la API

```powershell
cd core-service
$env:SPRING_PROFILES_ACTIVE = "local"
.\gradlew.bat bootRun
```

Si preferís no crear el archivo, la alternativa equivalente es inyectar todo por variables de
entorno (en este caso la clave JWT se llama `JWT_SECRET`):

```powershell
$env:DB_URL = "jdbc:postgresql://<host>/<db>?sslmode=require"
$env:DB_USERNAME = "<usuario>"
$env:DB_PASSWORD = "<contraseña>"
$env:JWT_SECRET = "<cadena-de-al-menos-32-caracteres>"
```

- **Sin perfil `local` ni variables, el backend no levanta**: Spring falla con un error de
  placeholder sin resolver (`Could not resolve placeholder 'DB_URL'`). Es el comportamiento
  querido, así nadie conecta el servicio contra una base sorpresa.
- El esquema se actualiza solo al arrancar (`ddl-auto=update` + migraciones legacy en `initData`, entre
  ellas `sanearRuidoPuntoFlotante`, que deja las cantidades históricas a dos decimales, y
  `normalizarUnidadesMedida`, que convierte unidades viejas a la notación profesional: `Kilos` → `kg`,
  `Litros` → `l`, `Docenas` → cantidad × 12 con `unidad`).
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
agrupado de filas homónimas en el descuento FIFO, ABM de gerentes (baja bloqueada con auditoría) y
redondeo de cantidades a dos decimales (merge, agregado y descuento con stock justo).

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
# false (default) = el escaneo de tickets y el dictado llaman al microservicio restosync-ia
# true = usa datos de ejemplo, sin levantar el puerto 8000 (solo para desarrollar)
NEXT_PUBLIC_USE_IA_MOCK=false
```

Con el flag en `true` el escaneo de tickets y el dictado traen datos de ejemplo que después se
confirman y guardan de verdad; útil si no querés levantar `restosync-ia` mientras desarrollás.

**Navegación por rol** (barra superior, también como menú en mobile): Inicio (`/dashboard`) ·
Operación (Inventario, Menú, Mesas, Agregar compra) · Análisis (Analítica, IA Predictiva) ·
Administración (Locales, Cuentas — solo Admin) · Sistema · Salir. En `/sistema` se ve el estado
del core y del servicio de IA y los datos de la sesión; **no se configura ninguna key desde el
navegador**: la única `GEMINI_API_KEY` es la del `.env` del microservicio.

## 3. Microservicio de IA (`restosync-ia`)

Tres funciones del front dependen de este servicio: la lectura de **tickets**, el **dictado por
voz** de insumos y el **monitor predictivo**. El navegador le envía el archivo o el texto
directamente (CORS ya habilitado para el front) y **la `GEMINI_API_KEY` vive únicamente en su
`.env`**; ningún otro módulo necesita configurar claves.

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

### Monitor predictivo de demanda (`/prediccion`)

Además del escaneo de tickets, `restosync-ia` expone la proyección de demanda que consume la
pantalla **IA Predictiva** (`/prediccion`). `/analitica` muestra solo métricas reales del local y
enlaza a `/prediccion` con el botón **Ver IA Predictiva →**. El **frontend es el punto de
composición**: el core no orquesta a la IA y la IA no toca la base de datos.

```
/prediccion
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
- En `/prediccion` se puede cambiar el horizonte (7 / 14 / 30 días) y la proyección se recalcula
  sin volver a pedir el historial al core. Si el servicio de IA está caído, aparece un aviso con
  botón **Reintentar** y la analítica actual queda intacta.

## Funcionalidades

- **Multi-local con roles**: Admin opera todos los locales de su restaurante (header `X-Local-Id`);
  el Gerente queda fijo al local asignado en su token.
- **Inventario por local** con lotes y vencimientos: cargar un insumo existente con el **mismo
  vencimiento suma** al lote; con **otro vencimiento crea una fila nueva** (una por vencimiento).
  Las filas agotadas se ocultan por defecto (toggle "Agotados") pero se conservan por auditoría.
- **Carga por IA**: foto de ticket → el microservicio `restosync-ia` (Gemini) extrae los productos
  con su `unidadMedida` → revisión editable → guardado en el local activo. El mock queda como
  opción de desarrollo. También hay CRUD correctivo manual de insumos.
- **Dictado por voz** (`/registro?modo=audio`): botones explícitos **Empezar a grabar** /
  **Terminar de grabar** (Web Speech API del navegador, `es-AR`, acumula varias frases). El texto
  se procesa con **Procesar dictado** contra `POST /api/v1/ia/dictar-insumos`, que devuelve **un
  ítem por producto** con `cantidad` y `unidadMedida` reales en notación profesional ("dos kilos de
  tomates y tres litros de leche" → 2 kg / 3 l). Si el servicio de IA no está o falla, el front cae a un
  **parser heurístico local** (`lib/dictado.ts`) con el mismo contrato y un aviso en pantalla;
  el tipo de medida (Peso/Volumen/Unidades) y su precisión quedan editables en la revisión antes de
  guardar.
- **Menú y recetas**: platos por local con ingredientes; al **preparar** se descuenta stock
  agrupando las filas homónimas y consumiendo **FIFO por vencimiento**, con prevalidación de faltantes.
- **Mesas**: mapa visual con arrastrar y soltar (posiciones persistidas) y estados
  Libre / Ocupada / Reservada. El panel de una mesa muestra solo los **platos de la ocupación en
  curso**: `GET /producciones?mesaId=` devuelve lo preparado desde que la mesa pasó a Ocupada (y
  nada si está Libre/Reservada), mientras que el historial completo sigue intacto en el `GET`
  global, en el dashboard y en analítica. Preparar un plato para una mesa la marca Ocupada.
- **Cuentas**: ABM de gerentes por el Admin (email único, contraseña BCrypt, reasignación de local).
  La baja se bloquea si la cuenta tiene movimientos o preparaciones registradas (auditoría).
- **Analítica (`/analitica`)**: conteos reales del local (stock, por vencer, menú, mesas),
  distribución por categoría, reposición sugerida por stock mínimo y últimas preparaciones.
- **IA Predictiva (`/prediccion`)**: sobre el historial real del local, el monitor predictivo
  proyecta la demanda de cada insumo (gráficos Recharts con horizonte 7 / 14 / 30 días), anticipa
  quiebres de stock y mermas, sugiere compras por prioridad y muestra recomendaciones redactadas
  por Gemini o, si la IA no responde, por reglas de consumo.

## API principal (`/api/v1`)

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /me` |
| Insumos | `GET/POST /insumos` · `PUT/DELETE /insumos/{id}` · `GET /lotes?insumoId=` |
| Menú | `GET/POST /platos` · `PUT/DELETE /platos/{id}` · `POST /platos/{id}/preparar` |
| Producciones | `GET /producciones?mesaId=` (con `mesaId`: solo los platos de la ocupación actual de esa mesa; sin `mesaId`: historial completo) |
| Mesas | `GET/POST /mesas` · `PUT/DELETE /mesas/{id}` (la entidad trae `fechaOcupacion`, marca de la sesión en curso) |
| Locales | `GET/POST /locales` · `PUT/DELETE /locales/{id}` |
| Cuentas | `GET/POST /cuentas-gerentes` · `PUT/DELETE /cuentas-gerentes/{id}` |
| Analítica | `GET /analitica/historial?dias=` (historial agregado del local para el monitor predictivo) |
| IA (`restosync-ia`, puerto 8000) | `POST /api/v1/ia/escanear-ticket` · `POST /api/v1/ia/dictar-insumos` · `POST /api/v1/ia/prediccion-demanda` |

El microservicio de IA es un **servicio aparte** que corre en el puerto 8000 y **comparte el prefijo
`/api/v1` con el core**: las tres rutas de la última fila pertenecen a `restosync-ia` (el navegador
las llama directo, sin pasar por el core), no a `core-service`.

Todas las rutas (excepto register/login) requieren `Authorization: Bearer <token>`; el Admin además
envía `X-Local-Id` en las rutas con scope de local.

## Documentación del proyecto

- `proyecto.md`: enunciado original.
- `Plan-General.md`: plan de las 6 fases del MVP, con los correctivos aplicados en cada una.
- `Plan-IA.md`: plan del módulo analítico y predictivo.
- `Plan-Mejoras.md`: auditoría y mejoras puntuales (seguridad de secretos, documentación, agentes).
- `Plan-Mesas-Dictado.md`: sesión de platos por mesa y dictado por voz (diseño, reglas de transición
  y verificación E2E).
- `AGENTS.md`: convenciones y trampas conocidas para quien trabaje en el repo con un agente de IA
  (raíz y por módulo).

Los tres `Plan-*.md` están gitignoreados a propósito: son documentos de trabajo locales, no
entregables del repo.