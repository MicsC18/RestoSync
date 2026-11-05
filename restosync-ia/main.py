import io
import json
import os
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


# ---------- Modelos del monitor predictivo (espejo de Plan-IA §1.1 y §1.2) ----------

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
    """Monitor predictivo: pandas calcula los números; Gemini solo redacta insights (§0.2, §1.2)."""
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
        Extrae los productos comprados y devuelve un JSON estricto con una lista llamada "itemsEncontrados".
        Cada objeto de la lista debe tener exactamente estas claves:
        - "nombre": Nombre claro del producto.
        - "categoria": Categoría lógica (ej. Lácteos, Carnes, Frutas y verduras, Almacén, Bebidas, Panadería).
        - "icono": Un emoji representativo del producto.
        - "cantidad": Número entero con la cantidad adquirida.
        - "diasRestantes": Días estimados de vida útil restantes a partir de la fecha actual, basándote en la fecha de vencimiento del documento o estimándola según el tipo de alimento si no la trae explícita.
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json"
        )

        # Bucle con modelos válidos activos en tu cuenta
        modelos_candidatos = [
            'gemini-3.5-flash-lite',
            'gemini-3.8-flash',
            'gemini-flash-latest',
            'gemini-3.7-flash',
            'gemini-3.5-flash'
        ]

        response = None
        ultimo_error = None

        for modelo in modelos_candidatos:
            try:
                print(f"Probando modelo: {modelo}...")
                response = client.models.generate_content(
                    model=modelo,
                    contents=[prompt_instrucciones, documento_part],
                    config=config
                )
                if response and response.text:
                    print(f"¡Éxito con el modelo {modelo}!")
                    break
            except Exception as err:
                ultimo_error = err
                print(f"El modelo {modelo} no pudo procesar ({err}). Intentando siguiente...")

        if not response or not response.text:
            raise HTTPException(
                status_code=503,
                detail=f"Servicio de IA no disponible temporalmente. Último error: {str(ultimo_error)}"
            )

        resultado_json = json.loads(response.text)
        items = resultado_json.get("itemsEncontrados", [])

        # Asignación automática del estado inicial predeterminado
        for item in items:
            item["estado"] = "Cerrado"

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