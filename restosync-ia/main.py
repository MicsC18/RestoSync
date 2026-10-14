import io
import json
import os
import traceback
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types, errors

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

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
    modelos = [m.name for m in client.models.list()]
    return {"modelos_disponibles": modelos}

@app.post("/api/v1/ia/escanear-ticket")
async def escanear_ticket(file: UploadFile = File(...)):
    try:
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