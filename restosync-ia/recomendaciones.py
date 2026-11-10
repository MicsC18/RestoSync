"""Capa Gemini + fallback por reglas para las recomendaciones del monitor (Plan-IA §1.4).

`generar_insights` recibe el resumen ya calculado por `prediccion.calcular_prediccion`
y devuelve {"fuente": "gemini"|"reglas", "recomendaciones": [{"titulo", "detalle"}]}.
Nunca lanza errores de Gemini hacia afuera: cualquier falla cae al fallback de reglas.
"""

import json
import os
from datetime import datetime

from google.genai import types

# Mismos modelos candidatos y timeout de §1.4
MODELOS_CANDIDATOS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
]
TIMEOUT_MS = 15_000
MAX_RECOMENDACIONES = 4
TOP_N_RESUMEN = 10


def hay_api_key_valida() -> bool:
    clave = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not clave:
        return False
    return clave.lower() not in ("clave_aqui", "tu_api_key_aqui", "changeme")


def _resumen_compacto(resumen: dict) -> str:
    """Resumen top 10 de demanda, mermas y compras. No se envían filas crudas del historial (§1.4)."""
    lineas = []
    demanda = resumen.get("demanda", [])[:TOP_N_RESUMEN]
    if demanda:
        lineas.append("Demanda proyectada (top):")
        for d in demanda:
            quiebre = d["fechaQuiebre"] or "fuera del horizonte"
            lineas.append(
                f"- {d['nombre']}: base {d['consumoDiarioBase']} {d['unidadMedida']}/día, "
                f"total {d['totalProyectado']}, stock {d['stockActual']}, "
                f"cobertura {d['coberturaDias']} días, quiebre {quiebre}."
            )
    mermas = resumen.get("mermas", [])[:TOP_N_RESUMEN]
    if mermas:
        lineas.append("Mermas en riesgo:")
        for m in mermas:
            lineas.append(
                f"- {m['nombre']}: {m['cantidadEnRiesgo']} {m['unidadMedida']} "
                f"vencen el {m['fechaVencimiento']}."
            )
    compras = resumen.get("compras", [])[:TOP_N_RESUMEN]
    if compras:
        lineas.append("Compras sugeridas por reglas:")
        for c in compras:
            lineas.append(
                f"- {c['nombre']}: {c['cantidadSugerida']} {c['unidadMedida']} "
                f"(prioridad {c['prioridad']})."
            )
    return "\n".join(lineas)


def _armar_prompt(resumen_texto: str) -> str:
    return f"""
    Eres un asistente experto en gestión de inventarios gastronómicos.
    A partir del siguiente resumen de proyección de demanda de un local, redactá
    recomendaciones prácticas de compras y rotación de stock, en español (Argentina, voseo).

    RESUMEN:
    {resumen_texto}

    Devolvé un JSON estricto con esta forma exacta:
    {{"recomendaciones": [{{"titulo": "...", "detalle": "..."}}]}}
    - Máximo {MAX_RECOMENDACIONES} recomendaciones.
    - "titulo": una acción concreta y breve.
    - "detalle": explicación de 1 a 3 frases con los números relevantes.
    - No inventes datos: usá únicamente los del resumen.
    """.strip()


def _llamar_gemini(resumen_texto: str, client) -> str:
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        http_options=types.HttpOptions(timeout=TIMEOUT_MS),
    )
    ultimo_error = None
    for modelo in MODELOS_CANDIDATOS:
        try:
            response = client.models.generate_content(
                model=modelo,
                contents=[_armar_prompt(resumen_texto)],
                config=config,
            )
            if response and response.text:
                return response.text
        except Exception as err:  # modelo no disponible / cuota / red
            ultimo_error = err
    raise RuntimeError(f"Gemini no pudo generar recomendaciones: {ultimo_error}")


def _parsear_recomendaciones(texto: str) -> list:
    datos = json.loads(texto)
    items = datos.get("recomendaciones") if isinstance(datos, dict) else None
    if not isinstance(items, list):
        raise ValueError("Respuesta de Gemini sin lista 'recomendaciones'")
    recomendaciones = []
    for item in items[:MAX_RECOMENDACIONES]:
        if not isinstance(item, dict):
            continue
        titulo = (item.get("titulo") or "").strip()
        detalle = (item.get("detalle") or "").strip()
        if titulo and detalle:
            recomendaciones.append({"titulo": titulo, "detalle": detalle})
    if not recomendaciones:
        raise ValueError("Recomendaciones de Gemini vacías o inválidas")
    return recomendaciones


def _formatear_ddmm(fecha_iso: str) -> str:
    try:
        return datetime.strptime(fecha_iso, "%Y-%m-%d").strftime("%d/%m")
    except (ValueError, TypeError):
        return fecha_iso


def insights_por_reglas(resumen: dict) -> list:
    """Fallback de §1.4: 2-3 recomendaciones por plantilla desde compras y mermas."""
    recomendaciones = []
    for compra in resumen.get("compras", [])[:2]:
        recomendaciones.append({
            "titulo": f"Reponé {compra['nombre']}",
            "detalle": f"Se sugieren {compra['cantidadSugerida']:.0f} {compra['unidadMedida']}. "
                       f"{compra['motivo']} Prioridad {compra['prioridad'].lower()}.",
        })
    for merma in resumen.get("mermas", [])[:1]:
        recomendaciones.append({
            "titulo": f"Usá {merma['nombre']} antes del {_formatear_ddmm(merma['fechaVencimiento'])}",
            "detalle": f"{merma['cantidadEnRiesgo']} {merma['unidadMedida']} quedan en riesgo de "
                       f"merma porque vencen antes de consumirse. Priorizá su rotación.",
        })
    if not recomendaciones:
        recomendaciones.append({
            "titulo": "Stock cubierto para el horizonte",
            "detalle": "Las reglas de consumo no detectan quiebres ni mermas relevantes en los "
                       "próximos días. Mantené la rotación habitual.",
        })
    return recomendaciones[:MAX_RECOMENDACIONES]


def _ins_insuficiente() -> dict:
    return {
        "fuente": "reglas",
        "recomendaciones": [{
            "titulo": "Todavía falta historial para proyectar",
            "detalle": "El local no tiene al menos 7 días de consumos registrados. "
                       "Seguí cargando compras y preparaciones: en unos días el monitor "
                       "podrá proyectar la demanda.",
        }],
    }


def generar_insights(resumen: dict, client) -> dict:
    """Insights en lenguaje natural: Gemini si es posible, reglas en cualquier otro caso (§1.4)."""
    if resumen.get("datosInsuficientes"):
        return _ins_insuficiente()
    if not hay_api_key_valida():
        return {"fuente": "reglas", "recomendaciones": insights_por_reglas(resumen)}
    try:
        texto = _llamar_gemini(_resumen_compacto(resumen), client)
        return {"fuente": "gemini", "recomendaciones": _parsear_recomendaciones(texto)}
    except Exception:
        return {"fuente": "reglas", "recomendaciones": insights_por_reglas(resumen)}
