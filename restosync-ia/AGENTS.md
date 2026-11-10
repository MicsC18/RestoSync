# restosync-ia — instrucciones para agentes de IA

Microservicio Python · FastAPI en el puerto 8000, sin base de datos y sin autenticación propia.
Convenciones generales del proyecto: [`../AGENTS.md`](../AGENTS.md).

## Responsabilidades (tres, y nada más)

1. **Lectura de tickets** — `POST /api/v1/ia/escanear-ticket` (`main.py`): Gemini multimodal
   directo con la imagen/PDF, **sin OCR intermedio**; devuelve `itemsEncontrados` con
   `nombre`, `categoria`, `icono`, `cantidad`, `diasRestantes`, `unidadMedida` y `estado` fijo
   `"Cerrado"`.
2. **Dictado de insumos** — `POST /api/v1/ia/dictar-insumos` (`main.py`, body `{ texto }`):
   mismo contrato que tickets **más** `unidadMedida`, extraído del texto ("dos kilos de tomates"
   → `2` / `"Kilos"`; `"Unidades"` si el dictado no indica ninguna). Un producto = un ítem (si
   se repite, se suma), y un texto sin productos = lista vacía.
3. **Monitor predictivo** — `POST /api/v1/ia/prediccion-demanda`: recibe el historial ya armado
   por el front en el body y devuelve demanda proyectada, mermas, compras e insights.

## Separación de responsabilidades (no negociar)

- **`prediccion.py` (pandas) calcula todos los números**: es determinístico y se prueba con
  `pytest`. Cualquier número nuevo del contrato sale de acá.
- **`recomendaciones.py` (Gemini) solo redacta texto**: ningún número sale de un LLM.
- `prediccion-demanda` **nunca devuelve `5xx` por un problema de Gemini**: el `except` cae a
  `insights.fuente = "reglas"` (y en el peor caso a una recomendación genérica). `datosInsuficientes:
  true` es un `200`, no un error.
- **Excepción deliberada a la regla anterior**: `escanear-ticket` y `dictar-insumos` **sí devuelven
  `5xx`** cuando Gemini no responde (sin clave válida → `503`; ningún modelo de la cadena → `503`;
  `ServerError` de Google → `503`; resto → `500`), y `dictar-insumos` además `400` con `texto`
  vacío. No es un olvido: en extracción de datos una respuesta "inventada" por un fallback interno
  sería peor que un error, así que **la atenuación vive del lado del front** (`lib/dictado.ts`
  reinterpeta el texto con un parser local y avisa en pantalla). No mover esa atenuación a este
  servicio sin consenso.
- El servicio **no accede a la base de datos ni conoce roles/usuarios**; el historial llega en el
  body desde el navegador. Una propuesta de "conectar la IA a Postgres" o de "autenticar la IA" se
  rechaza por diseño (ver `Plan-Mejoras.md` §6).

## Endpoints y CORS

- `GET /` (estado), `GET /modelos` (503 sin key válida), `POST /api/v1/ia/prediccion-demanda`,
  `POST /api/v1/ia/escanear-ticket`, `POST /api/v1/ia/dictar-insumos`.
- El navegador lo llama **directo** (el core no reenvía). La lista de orígenes en `main.py`
  (`localhost:3000`, `127.0.0.1:3000`, `localhost:8080`, regex `192.168.x.x:3000` para probar desde
  el teléfono) **debe mantenerse sincronizada con `CorsConfig.kt` del core**: dos servicios con la
  misma política de orígenes, cambiada a mano.

## Modelos de Gemini

`escanear_ticket` y `dictar_insumos` recorren `modelos_candidatos` con fallback en cadena porque la
cuota o disponibilidad de un modelo no está garantizada. Un modelo nuevo **se agrega al principio de
la lista en **ambos endpoints** (hay dos listas copiadas, una por función: agregar un modelo a una
y no a la otra deja los endpoints desalineados); nunca se deja un único modelo fijo. El `503` con
clave ausente es intencional: el front tiene su flag `NEXT_PUBLIC_USE_IA_MOCK` para trabajar sin IA.

La normalización **defensiva post-response** es obligatoria en los dos endpoints de extracción:
`setdefault`/`or` por clave (`unidadMedida → "Unidades"`, `diasRestantes → 30`, `categoria →
"Almacén"`, ítems sin `nombre` se descartan) porque el front depende del contrato completo.

## Secretos

La `GEMINI_API_KEY` **solo** vive en `restosync-ia/.env` (gitignoreado). No se acepta por request,
header, query ni `localStorage`, y no se copia a ningún otro archivo. `/sistema` del front explica
que no se configura ninguna key desde el navegador.

## Correr y verificar

```powershell
cd restosync-ia                 # el cwd DEBE estar acá, si no load_dotenv() no encuentra .env
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
pytest -q
```

- Con el cwd mal puesto el escaneo responde fuente `"reglas"` en vez de `"gemini"` — parece un bug
  de Gemini y es de entorno.
- ⚠️ **Smart App Control de Windows** puede bloquear los binarios del `venv`
  (`_pydantic_core.pyd`, `pytest.exe`): en ese caso correr con el CPython global que ya tiene las
  dependencias, `C:\Python314\python.exe -m uvicorn main:app --port 8000` y
  `C:\Python314\python.exe -m pytest -q`.
- Mover la carpeta del proyecto deja rotos los launchers `.exe` del `venv`: recrear el venv o usar
  `python -m ...` como arriba.
- El puerto 8000 a veces queda ocupado por un uvicorn hijo (`WinError 10013`, o respuestas
  inconsistentes por doble bind): verificar con `netstat -ano` y `Stop-Process` antes de relanzar.
