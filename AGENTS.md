# RestoSync — instrucciones para agentes de IA

## 1. Qué es el proyecto

Sistema de control de inventario y mermas para restaurantes con carga de compras por lectura de
tickets y dictado por voz con IA, y monitor predictivo de demanda. Trabajo final universitario; todo
el dominio está en español (Argentina).

| Módulo | Stack | Puerto |
|---|---|---|
| `core-service/` | Kotlin · Spring Boot · JPA/PostgreSQL (Neon) | 8080 |
| `restosync-front/` | Next.js (App Router) · React · Tailwind · TypeScript | 3000 |
| `restosync-ia/` | Python · FastAPI · Gemini SDK · pandas | 8000 |

El front llama **directo** al core (8080) y a la IA (8000). El core **no orquesta** a la IA y la IA
**no toca la base de datos**. Cada módulo tiene su propio `AGENTS.md` con las convenciones locales.

## 2. Cómo correr (PowerShell)

```powershell
# core-service — necesita el perfil local con las credenciales (README.md, "Guía rápida")
cd core-service
$env:SPRING_PROFILES_ACTIVE = "local"
.\gradlew.bat bootRun

# restosync-ia — el cwd DEBE estar en la carpeta del módulo, si no no carga .env
#               y /escanear-ticket responde con fuente "reglas" en vez de "gemini"
cd restosync-ia
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000

# restosync-front
cd restosync-front
npm run dev
```

## 3. Detener los servicios al terminar

Requisito explícito del flujo de trabajo: ninguna de las tres apps queda corriendo al cerrar la
tarea. Matar por puerto en Windows, en este orden:

```powershell
netstat -ano | Select-String ":8080|:3000|:8000"   # obtener el PID
Stop-Process -Id <PID> -Force
```

- `Get-NetTCPConnection` puede no detectar el puerto ocupado: usar `netstat -ano`.
- `Process.Kill($true)` falla en PowerShell 5.1: usar `Stop-Process`.
- Un `python -m uvicorn` hijo puede sobrevivir al proceso padre y dejar una respuesta inconsistente
  en 8000 (doble bind): verificar el puerto libre antes de relanzar.

## 4. Restricciones de alcance

**No pagos, no cobros, no cajas**: ni entidades, ni endpoints, ni pantallas. Dos roles y nada más
(`ADMIN`, `GERENTE`). Cualquier feature que se parezca a una caja registradora o a una factura de
venta está fuera del alcance acordado, aunque "complete" el sistema.

## 5. Idioma

Español (Argentina) en UI, DTOs, campos de dominio, mensajes de error y documentación:
`contrasena`, `insumo`, `local`, `diasRestantes`, `mermas`. Voseo en los textos ("Revisá",
"Completá"). Los términos técnicos de herramientas (`build`, `push`, `endpoint`) se conservan en
inglés. No introducir labels en inglés en componentes.

## 6. Reglas de dominio que no se pueden romper

Detalle completo con su justificación en `Plan-General.md` §4.4/§4.5 (ver §8 abajo):

- Alta de lote existente si coincide `local` + nombre normalizado + **vencimiento exacto**; se
  acumula la cantidad. **Vencimiento distinto crea fila visible nueva** (no se oculta ni se
  fusiona con otro lote).
- Al preparar una receta se agrupan las filas homónimas del insumo y se consume **FIFO por
  vencimiento**.
- La fila en stock cero **no se borra**: queda como registro.
- El historial sobrevive a los borrados vía **snapshots** (nombre y unidad copiados en el
  movimiento); borrar un insumo no reescribe el pasado.
- **Sesión de platos por mesa**: con `mesaId`, `GET /producciones` devuelve solo lo preparado desde
  que la mesa pasó a OCUPADA (`Mesa.fechaOcupacion`) y nada si está Libre/Reservada. El filtro vive
  **solo en el core** (la UI no decide esto) y **no cambia** el `GET` global: el historial sigue
  completo en dashboard y analítica. Ver `Plan-Mesas-Dictado.md` §1.
- **Cantidades a dos decimales**: toda `Double` que se persiste o se compara en el core pasa por
  `com.restosync.core.util.redondear` (y `cantidadLegible` para los mensajes). Las sumas y restas
  del dominio acumulan ruido de punto flotante (`0.1 + 0.2 = 0.30000000000000004`) que antes se
  guardaba en `lotes.cantidad` / `insumos.cantidad` y se veía como `9.200000000000003`. Regla
  fija en `InventarioServiceRedondeoTest` y `CantidadesTest`; el front además formatea con
  `lib/numero.ts`.

## 7. Cómo verificar un cambio

| Módulo | Comando |
|---|---|
| `core-service` | `.\gradlew.bat compileKotlin` y `.\gradlew.bat test` (unitarios, sin DB) |
| `restosync-front` | `npx tsc --noEmit` y `npm run build` |
| `restosync-ia` | `pytest -q` |

Detener `npm run dev` antes de `npm run build`: chocan en `.next`. Detener los daemons de Gradle
(`.\gradlew.bat --stop`) al terminar si quedan colgados.

## 8. Mapa de documentación

| Archivo | Contiene |
|---|---|
| `README.md` | **guía rápida numerada (5 pasos)** para instalar y correr sin conocer el proyecto, más el detalle por módulo, configuraciones, endpoints y funcionalidades |
| `proyecto.md` | enunciado del trabajo final |
| `Plan-General.md` | las 6 fases del MVP con **más de 30 correctivos** registrados y las reglas de dominio (§4) |
| `Plan-IA.md` | módulo predictivo: contratos, fórmulas (§1.3), capas |
| `Plan-Mejoras.md` | auditoría de seguridad/documentación y su estado de implementación (Fases A–E) |
| `Plan-Mesas-Dictado.md` | sesión de platos por mesa (transiciones de `fechaOcupacion`) y dictado por voz (motor híbrido + parser local) |

**Los `Plan-*.md` están gitignoreados a propósito** (documentos de trabajo locales, no
entregrables). Consecuencia operativa: `Glob` y `Grep` **no los ven** (el Grep los filtra por
reglas de ignore), pero `Read` con la ruta exacta funciona. Las sesiones de trabajo se registran
en esos archivos, **no** en el `README.md`.

## 9. Trampas conocidas

- PowerShell inline pierde los `$` en comandos complejos: escribir un `.ps1` y ejecutarlo.
- SQL inline se rompe por lo mismo: usar script `.sql` y el cliente correspondiente.
- Mover la carpeta del proyecto deja rotos los launchers `.exe` del `venv`: recrear el venv o
  lanzar con `python -m uvicorn` / `python -m pytest`.
- Secuencia de Postgres desincronizada causa `duplicate key` en el seed (el core ya corre
  `sincronizarSecuencias` al arrancar).
- `pypdf` falla con `FileNotFoundError` en PDFs con acentos en la ruta; DOCX/PPTX se leen por
  descompresión XML si no está la librería.
- `Write` no puede crear archivos fuera de la raíz del workspace.
- Params de funciones Kotlin de test: no usar el nombre `con` (rompe el parser).
- En Spring 7 leer `statusCode` (no `status`) de `ResponseStatusException`; matchers de Mockito
  revientan por unboxing contra `double` → usar `anyDouble()`.
- Los `Plan-*.md` invisibles para `Glob`/`Grep` (ver §8).
