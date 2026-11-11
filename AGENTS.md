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

- Merge de filas equivalentes si coincide `local` + nombre normalizado + **misma unidad** +
  **vencimiento exacto**; se acumula la cantidad. Aplica al **alta y a la edición**: si al corregir
  una fila queda igual a otra, se fusionan en la existente (lotes, recetas y auditoría incluidas).
  **Vencimiento distinto crea fila visible nueva** (no se oculta ni se fusiona con otro lote).
- Al preparar una receta se agrupan las filas homónimas del insumo y se consume **FIFO por
  vencimiento**.
- La fila en stock cero **no se borra**: queda como registro.
- El historial sobrevive a los borrados vía **snapshots** (nombre y unidad copiados en el
  movimiento); borrar un insumo no reescribe el pasado.
- **Sesión de platos por mesa**: con `mesaId`, `GET /producciones` devuelve solo lo preparado desde
  que la mesa pasó a OCUPADA (`Mesa.fechaOcupacion`) y nada si está Libre/Reservada. El filtro vive
  **solo en el core** (la UI no decide esto) y **no cambia** el `GET` global: el historial sigue
  completo en dashboard y analítica.
- **Cantidades a dos decimales**: toda `Double` que se persiste o se compara en el core pasa por
  `com.restosync.core.util.redondear` (y `cantidadLegible` para los mensajes). Las sumas y restas
  del dominio acumulan ruido de punto flotante (`0.1 + 0.2 = 0.30000000000000004`) que antes se
  guardaba en `lotes.cantidad` / `insumos.cantidad` y se veía como `9.200000000000003`. Regla
  fija en `InventarioServiceRedondeoTest` y `CantidadesTest`; el front además formatea con
  `lib/numero.ts`.
- **Unidades profesionales en dos niveles**: la unidad de un insumo es un símbolo (`kg/g/mg` de peso,
  `l/ml` de volumen, `unidad` contable) guardado en `insumos.unidad_medida`; el "tipo de medida"
  (Peso/Volumen/Unidades) es solo de UI y se deriva del símbolo. Fuente única en el front:
  `lib/insumos.ts` (`UNIDADES_POR_TIPO`), espejada en los prompts de `restosync-ia/main.py` (ambas
  listas se mantienen sincronizadas a mano). Quedaron retiradas las unidades informales de envase
  (Docenas, Paquetes, Latas, Atados): la migración `normalizarUnidadesMedida` las convierte al
  arrancar (Docenas → ×12 `unidad`). No volver a aceptarlas en UI, prompts ni seeds.

## 7. Cómo verificar un cambio

| Módulo | Comando |
|---|---|
| `core-service` | `.\gradlew.bat compileKotlin` y `.\gradlew.bat test` (unitarios, sin DB) |
| `core-service` (HTTP) | `npx --yes newman run core-service/postman/RestoSync-API.postman_collection.json` (colección Postman/Newman de JWT/RBAC/X-Local-Id; requiere el core levantado con perfil local + seed demo) |
| `restosync-front` | `npx tsc --noEmit` y `npm run build` |
| `restosync-ia` | `pytest -q` |

Detener `npm run dev` antes de `npm run build`: chocan en `.next`. Detener los daemons de Gradle
(`.\gradlew.bat --stop`) al terminar si quedan colgados.

## 8. Mapa de documentación

| Archivo | Contiene |
|---|---|
| `README.md` | **guía rápida numerada (5 pasos)** para instalar y correr sin conocer el proyecto, más el detalle por módulo, configuraciones, endpoints y funcionalidades |
| `proyecto.md` | enunciado del trabajo final |

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
- Los archivos gitignoreados son invisibles para `Glob`/`Grep`; `Read` con la ruta exacta sí los ve.
