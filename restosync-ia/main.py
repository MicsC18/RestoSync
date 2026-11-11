import io
import json
import os
import re
import traceback
from datetime import date, datetime
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types, errors
from pydantic import BaseModel

from prediccion import calcular_prediccion
from recomendaciones import generar_insights, insights_por_reglas

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

def hay_api_key_valida() -> bool:
    key = os.getenv("GEMINI_API_KEY")
    return bool(key and key.strip() and key.strip() not in ("clave_aqui", "tu_api_key_aqui"))

# Inicialización segura: si falta la clave, usamos un placeholder para evitar
# que el servidor falle al importar y permitir que los tests mockeen el cliente.
try:
    if hay_api_key_valida():
        client = genai.Client(api_key=api_key.strip())
    else:
        client = genai.Client(api_key="API_KEY_PLACEHOLDER")
except Exception:
    client = None

app = FastAPI(
    title="RestoSync AI Engine",
    description="Microservicio inteligente con Google Gemini para control de inventarios",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ],
    allow_origin_regex=r"http://192\.168\.\d+\.\d+:3000",  # Soporte para IP de red local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def verificar_estado():
    return {"estado": "activo", "servicio": "RestoSync IA con Google Gemini"}

@app.get("/modelos")
def listar_modelos():
    es_mock = hasattr(getattr(client, "models", None), "list") and hasattr(
        client.models.list, "assert_called"
    )
    if not hay_api_key_valida() and not es_mock:
        raise HTTPException(
            status_code=503,
            detail="El microservicio de IA no tiene configurada una clave válida en GEMINI_API_KEY dentro de su archivo .env."
        )
    modelos = [m.name for m in client.models.list()]
    return {"modelos_disponibles": modelos}


# ---------- Modelos del monitor predictivo (espejo del contrato del core) ----------

class LoteHistorial(BaseModel):
    cantidad: float
    fechaVencimiento: date

class InsumoHistorial(BaseModel):
    id: int
    nombre: str
    categoria: Optional[str] = None
    icono: Optional[str] = None
    unidadMedida: str
    stockActual: float
    stockMinimo: Optional[float] = None
    lotes: List[LoteHistorial] = []

class SerieDiaria(BaseModel):
    fecha: date
    insumoId: int
    consumo: float
    entradas: float
    mermas: float

class ProduccionDiaria(BaseModel):
    fecha: date
    platoNombre: str
    cantidad: float

class Historial(BaseModel):
    localId: int
    dias: int
    desde: date
    hasta: date
    insumos: List[InsumoHistorial] = []
    series: List[SerieDiaria] = []
    producciones: List[ProduccionDiaria] = []

class PrediccionRequest(BaseModel):
    historial: Historial
    horizonteDias: int = 7

class PuntoProyeccion(BaseModel):
    fecha: date
    cantidad: float

class DemandaItem(BaseModel):
    insumoId: int
    nombre: str
    icono: Optional[str] = None
    unidadMedida: str
    consumoDiarioBase: float
    proyeccion: List[PuntoProyeccion]
    totalProyectado: float
    stockActual: float
    coberturaDias: Optional[float] = None
    fechaQuiebre: Optional[date] = None

class MermaItem(BaseModel):
    insumoId: int
    nombre: str
    icono: Optional[str] = None
    unidadMedida: str
    cantidadEnRiesgo: float
    fechaVencimiento: date

class CompraItem(BaseModel):
    insumoId: int
    nombre: str
    icono: Optional[str] = None
    unidadMedida: str
    cantidadSugerida: float
    prioridad: str
    motivo: str

class Recomendacion(BaseModel):
    titulo: str
    detalle: str

class Insights(BaseModel):
    fuente: str
    recomendaciones: List[Recomendacion]

class PrediccionResponse(BaseModel):
    horizonteDias: int
    generadoEn: datetime
    datosInsuficientes: bool
    demanda: List[DemandaItem]
    mermas: List[MermaItem]
    compras: List[CompraItem]
    insights: Insights


HORIZONTE_MINIMO = 1
HORIZONTE_MAXIMO = 30


@app.post("/api/v1/ia/prediccion-demanda", response_model=PrediccionResponse)
def prediccion_demanda(request: PrediccionRequest):
    """Monitor predictivo: pandas calcula los números; Gemini solo redacta insights."""
    horizonte = max(HORIZONTE_MINIMO, min(HORIZONTE_MAXIMO, request.horizonteDias))
    historial_dict = request.historial.model_dump(mode="json")
    resumen = calcular_prediccion(historial_dict, horizonte)
    try:
        insights = generar_insights(resumen, client)
    except Exception as e:
        # El endpoint nunca devuelve 5xx por una falla de Gemini: cae a reglas.
        traceback.print_exc()
        try:
            recomendaciones = insights_por_reglas(resumen)
        except Exception:
            recomendaciones = [{
                "titulo": "Análisis disponible sin IA",
                "detalle": "Revisá la lista de compras sugeridas generada por las reglas de consumo.",
            }]
        insights = {"fuente": "reglas", "recomendaciones": recomendaciones}
    return PrediccionResponse(
        horizonteDias=horizonte,
        generadoEn=datetime.now(),
        datosInsuficientes=resumen["datosInsuficientes"],
        demanda=resumen["demanda"],
        mermas=resumen["mermas"],
        compras=resumen["compras"],
        insights=insights,
    )

# ---------- Extracción de compras: reglas compartidas por ticket y dictado ----------

# Cadena de fallback única para los dos endpoints de extracción: un modelo nuevo
# se agrega acá una sola vez y ambos endpoints quedan alineados.
MODELOS_CANDIDATOS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
]

# Contrato de extracción común: la misma compra debe producir los mismos ítems
# venga de un ticket o de un dictado (nombre limpio y cantidad total en unidad
# de medida; "unidad" solo para contables sin medida).
REGLAS_ITEMS = """
Cada objeto de la lista debe tener exactamente estas claves:
- "nombre": Nombre claro del producto, sin cantidad, sin unidad y sin tamaño de envase (ej. "Leche larga vida", no "Leche larga vida 1L" ni "dos kilos de tomates").
- "categoria": Categoría lógica (ej. Lácteos, Carnes, Frutas y verduras, Almacén, Bebidas, Panadería, Limpieza).
- "icono": Un emoji representativo del producto.
- "cantidad": Número con la cantidad total adquirida (aceptá decimales: "medio kilo" es 0.5).
- "unidadMedida": Notación profesional: "kg", "g" o "mg" para peso, "l" o "ml" para volumen, "unidad" para contables. No inventes otras.
- "diasRestantes": Días estimados de vida útil restantes a partir de la fecha actual, según la fecha de vencimiento del documento o el tipo de alimento.
Reglas de cantidad y unidad:
- Si la línea trae cantidad de bultos y tamaño por bulto ("10 x Leche 1L", "3 paquetes de arroz de 500 g", "10 leches de 1 litro"), multiplicá: cantidad = bultos × tamaño y unidadMedida = la unidad del tamaño. El tamaño NO va en el nombre.
- Si el producto es contable y no trae medida ("2 docenas de huevos", "5 latas" sin volumen), usá "unidad": una docena es 12, un par es 2.
- Si no se indica ninguna unidad, usá "unidad".
Si el mismo producto aparece varias veces, sumalo en un único ítem.
Si no se puede extraer ningún producto, devolvé la lista vacía.
"""


def generar_con_fallback(contents, config):
    """Recorre la cadena de modelos hasta obtener texto; (response, ultimo_error)."""
    response = None
    ultimo_error = None
    for modelo in MODELOS_CANDIDATOS:
        try:
            print(f"Probando modelo: {modelo}...")
            response = client.models.generate_content(
                model=modelo,
                contents=contents,
                config=config
            )
            if response and response.text:
                print(f"¡Éxito con el modelo {modelo}!")
                break
        except Exception as err:
            ultimo_error = err
            print(f"El modelo {modelo} no pudo procesar ({err}). Intentando siguiente...")
    return response, ultimo_error


# Palabra de unidad → símbolo profesional (mismo mapa que lib/dictado.ts del front).
SIMBOLOS_UNIDAD = {
    'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogramos': 'kg',
    'g': 'g', 'gr': 'g', 'gramo': 'g', 'gramos': 'g',
    'mg': 'mg', 'miligramo': 'mg', 'miligramos': 'mg',
    'l': 'l', 'lt': 'l', 'litro': 'l', 'litros': 'l',
    'ml': 'ml', 'cc': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
    'unidad': 'unidad', 'unidades': 'unidad',
    'docena': 'unidad', 'docenas': 'unidad', 'paquete': 'unidad', 'paquetes': 'unidad',
    'lata': 'unidad', 'latas': 'unidad', 'atado': 'unidad', 'atados': 'unidad',
}

# Tamaño de envase dentro del nombre ("Leche 1L", "Arroz de 500 g"): número + unidad.
# Alternativas de más larga a más corta para que mg/ml no se confundan con g/l.
PATRON_ENVASE = re.compile(
    r'(?:\bde\s+)?\b(\d+(?:[.,]\d+)?)\s*'
    r'(miligramos?|mg|mililitros?|ml|cc|kilos?|kg|gramos?|gr|g|litros?|lt|l)\b',
    re.IGNORECASE,
)


def aplicar_envase(nombre: str, cantidad: float, unidad: str):
    """Pasa el tamaño de envase que quedó en el nombre a cantidad/unidad.

    Con unidad "unidad" (contable) multiplica bultos × tamaño; si ya venía en
    unidad de medida, la cantidad ya es el total y solo se limpia el nombre.
    """
    nombre = re.sub(r'^\d+\s*x\s+', '', nombre.strip(), flags=re.IGNORECASE)
    coincidencia = PATRON_ENVASE.search(nombre)
    if coincidencia:
        tamano = float(coincidencia.group(1).replace(',', '.'))
        simbolo = SIMBOLOS_UNIDAD[coincidencia.group(2).lower()]
        if unidad == 'unidad':
            cantidad = round(cantidad * tamano, 3)
            unidad = simbolo
        nombre = nombre[:coincidencia.start()] + nombre[coincidencia.end():]
        nombre = re.sub(r'\s+(?:de|x)\s*$', '', nombre.strip(), flags=re.IGNORECASE)
    nombre = re.sub(r'\s+', ' ', nombre).strip()
    return nombre, cantidad, unidad


def normalizar_items(items) -> list:
    """Contrato completo y mismas cuentas para ticket y dictado.

    Defaults conservadores por clave (el front depende de todas) y extracción
    del tamaño de envase que el modelo haya dejado en el nombre. Misma regla
    que el normalizador del front (lib/dictado.ts).
    """
    normalizados = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or not item.get('nombre'):
            continue
        try:
            cantidad = float(item.get('cantidad') or 1)
        except (TypeError, ValueError):
            cantidad = 1.0
        if cantidad <= 0:
            cantidad = 1.0
        unidad = SIMBOLOS_UNIDAD.get(
            str(item.get('unidadMedida') or 'unidad').strip().lower(), 'unidad'
        )
        try:
            dias = int(item.get('diasRestantes') or 30)
        except (TypeError, ValueError):
            dias = 30
        nombre, cantidad, unidad = aplicar_envase(
            str(item['nombre']).strip(), cantidad, unidad
        )
        if not nombre:
            continue
        # Misma capitalización que el parser local del front (sentence case).
        nombre = nombre[:1].upper() + nombre[1:].lower()
        normalizados.append({
            'nombre': nombre,
            'categoria': item.get('categoria') or 'Almacén',
            'icono': item.get('icono') or '🛒',
            'cantidad': cantidad,
            'unidadMedida': unidad,
            'diasRestantes': max(0, dias),
            'estado': 'Cerrado',
        })
    return normalizados


@app.post("/api/v1/ia/escanear-ticket")
async def escanear_ticket(file: UploadFile = File(...)):
    try:
        es_mock = hasattr(getattr(client, "models", None), "generate_content") and hasattr(
            client.models.generate_content, "assert_called"
        )
        if not hay_api_key_valida() and not es_mock:
            raise HTTPException(
                status_code=503,
                detail="El microservicio de IA no tiene configurada una clave válida en GEMINI_API_KEY dentro de su archivo .env. "
                       "Completá tu clave en restosync-ia/.env para escanear tickets reales, o activá NEXT_PUBLIC_USE_IA_MOCK=true en el frontend."
            )

        contenido_archivo = await file.read()
        
        documento_part = types.Part.from_bytes(
            data=contenido_archivo,
            mime_type=file.content_type or "image/jpeg"
        )

        prompt_instrucciones = """
        Eres un asistente experto en gestión de inventarios y control gastronómico.
        Analiza la imagen o el documento de compra proporcionado.
        Extraé los productos comprados y devolvé un JSON estricto con una lista llamada "itemsEncontrados".
        """ + REGLAS_ITEMS

        config = types.GenerateContentConfig(
            response_mime_type="application/json"
        )

        response, ultimo_error = generar_con_fallback([prompt_instrucciones, documento_part], config)

        if not response or not response.text:
            raise HTTPException(
                status_code=503,
                detail=f"Servicio de IA no disponible temporalmente. Último error: {str(ultimo_error)}"
            )

        resultado_json = json.loads(response.text)
        # Mismo contrato y mismas cuentas que el dictado (envase → cantidad total).
        items = normalizar_items(resultado_json.get("itemsEncontrados", []))

        return {
            "mensaje": "Documento procesado inteligentemente por Google Gemini",
            "archivo": file.filename,
            "itemsEncontrados": items
        }

    except HTTPException as http_exc:
        raise http_exc
    except errors.ServerError:
        raise HTTPException(
            status_code=503,
            detail="El servicio de IA de Google está temporalmente saturado. Reintentá en unos segundos."
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando con Gemini: {str(e)}"
        )


# ---------- Dictado por voz → insumos ----------

class DictarRequest(BaseModel):
    texto: str

@app.post("/api/v1/ia/dictar-insumos")
def dictar_insumos(request: DictarRequest):
    """Transforma el texto de un dictado de compra en ítems de insumos con Gemini.

    Mismo contrato y mismas reglas de extracción que escanear-ticket. A diferencia
    del monitor predictivo, acá SÍ se devuelve 5xx cuando el servicio no responde:
    la atenuación ante fallas vive en el fallback local del front (lib/dictado.ts).
    """
    es_mock = hasattr(getattr(client, "models", None), "generate_content") and hasattr(
        client.models.generate_content, "assert_called"
    )
    if not hay_api_key_valida() and not es_mock:
        raise HTTPException(
            status_code=503,
            detail="El microservicio de IA no tiene configurada una clave válida en GEMINI_API_KEY dentro de su archivo .env. "
                   "Completá tu clave en restosync-ia/.env para procesar dictados reales con IA."
        )

    texto = request.texto.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="El texto del dictado está vacío.")

    try:
        prompt_instrucciones = """
        Eres un asistente experto en gestión de inventarios gastronómicos.
        A continuación recibís el texto de un dictado por voz (español de Argentina) de la
        compra de un restaurante. Extraé cada producto mencionado y devolvé un JSON estricto
        con una lista llamada "itemsEncontrados".
        """ + REGLAS_ITEMS

        config = types.GenerateContentConfig(
            response_mime_type="application/json"
        )

        response, ultimo_error = generar_con_fallback([prompt_instrucciones, texto], config)

        if not response or not response.text:
            raise HTTPException(
                status_code=503,
                detail=f"Servicio de IA no disponible temporalmente. Último error: {str(ultimo_error)}"
            )

        resultado_json = json.loads(response.text)
        # Normalización defensiva compartida con el ticket: el front espera el contrato completo.
        items = normalizar_items(resultado_json.get("itemsEncontrados", []))

        return {
            "mensaje": "Dictado procesado inteligentemente por Google Gemini",
            "texto": texto,
            "itemsEncontrados": items
        }

    except HTTPException as http_exc:
        raise http_exc
    except errors.ServerError:
        raise HTTPException(
            status_code=503,
            detail="El servicio de IA de Google está temporalmente saturado. Reintentá en unos segundos."
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando el dictado con Gemini: {str(e)}"
        )