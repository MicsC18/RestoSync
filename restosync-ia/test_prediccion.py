"""Tests del monitor predictivo.

1. consumo constante → base, proyección y quiebre exactos
2. patrón semanal → factores acotados a 2.0
3. merma por vencimiento de lote
4. compra sugerida (ceil y prioridad ALTA)
5. historial insuficiente → 200 con datosInsuficientes
6. fallback de insights sin Gemini → fuente "reglas"
7. Gemini mockeado → fuente "gemini"; con excepción → "reglas" (nunca 5xx)
"""

import json
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import recomendaciones
from main import app
from prediccion import calcular_prediccion

client = TestClient(app)
HISTORIAL_ENDPOINT = "/api/v1/ia/prediccion-demanda"


def _iso(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def _insumo(insumo_id=1, nombre="Leche Larga Vida 1L", stock=10.0, minimo=1.0, lotes=None):
    return {
        "id": insumo_id, "nombre": nombre, "categoria": "Lácteos", "icono": "🥛",
        "unidadMedida": "Unidades", "stockActual": stock, "stockMinimo": minimo,
        "lotes": lotes or [],
    }


def _historial_constante(diario=2.0, ventana_dias=30, insumos=None, desde_offset=None):
    """Historial de `ventana_dias` días (hasta hoy) con consumo fijo por día para el insumo 1."""
    hoy = date.today()
    hasta = hoy
    desde = hoy - timedelta(days=ventana_dias - 1) if desde_offset is None else desde_offset
    insumos = insumos or [_insumo()]
    consumos = [
        {"fecha": _iso(desde + timedelta(days=i)), "insumoId": 1,
         "consumo": diario, "entradas": 0.0, "mermas": 0.0}
        for i in range(ventana_dias)
    ]
    return {
        "localId": 1, "dias": ventana_dias, "desde": _iso(desde), "hasta": _iso(hasta),
        "insumos": insumos, "series": consumos, "producciones": [],
    }


def test_prediccion_consumo_constante():
    hoy = date.today()
    resultado = calcular_prediccion(_historial_constante(diario=2.0, ventana_dias=30), horizonte=7)

    assert resultado["datosInsuficientes"] is False
    assert len(resultado["demanda"]) == 1
    item = resultado["demanda"][0]
    assert item["consumoDiarioBase"] == 2.0
    assert len(item["proyeccion"]) == 7
    assert all(p["cantidad"] == 2.0 for p in item["proyeccion"])
    assert item["totalProyectado"] == 14.0
    assert item["coberturaDias"] == 5.0  # stock 10 / base 2
    # Quiebre: acumulado 2,4,6,8,10,12 → supera stock 10 (estricto) en el sexto día
    assert item["fechaQuiebre"] == _iso(hoy + timedelta(days=6))


def test_prediccion_patron_semanal():
    hoy = date.today()
    desde = hoy - timedelta(days=29)
    consumos = []
    for i in range(30):
        dia = desde + timedelta(days=i)
        cantidad = 20.0 if dia.weekday() in (4, 5) else 1.0  # viernes y sábado duplican con creces
        consumos.append({"fecha": _iso(dia), "insumoId": 1, "consumo": cantidad,
                         "entradas": 0.0, "mermas": 0.0})
    historial = {
        "localId": 1, "dias": 30, "desde": _iso(desde), "hasta": _iso(hoy),
        "insumos": [_insumo(stock=1000.0)], "series": consumos, "producciones": [],
    }

    resultado = calcular_prediccion(historial, horizonte=14)
    item = resultado["demanda"][0]
    base = item["consumoDiarioBase"]  # (8*20 + 20*1)/28 ≈ 6.43
    esperado_alto = round(base * 2.0, 2)  # factor crudo > 2 → acotado a 2.0
    for p in item["proyeccion"]:
        dia = date.fromisoformat(p["fecha"])
        if dia.weekday() in (4, 5):
            assert p["cantidad"] == esperado_alto
        else:
            assert p["cantidad"] < esperado_alto
    # Días bajos: factor crudo < 0.5 → acotado a 0.5 (con tolerancia por redondeo a 2 decimales)
    assert round(0.5 * base, 2) - 0.01 <= min(p["cantidad"] for p in item["proyeccion"]) <= base


def test_merma_por_vencimiento():
    hoy = date.today()
    lotes = [{"cantidad": 5.0, "fechaVencimiento": _iso(hoy + timedelta(days=2))}]
    historial = _historial_constante(diario=2.0, insumos=[_insumo(lotes=lotes)])

    resultado = calcular_prediccion(historial, horizonte=7)
    assert len(resultado["mermas"]) == 1
    merma = resultado["mermas"][0]
    assert merma["insumoId"] == 1
    assert merma["fechaVencimiento"] == _iso(hoy + timedelta(days=2))
    # Consumo esperado de 2 días (mañana y pasado) = 2 + 2 → riesgo = 5 − 4 = 1
    assert merma["cantidadEnRiesgo"] == 1.0


def test_compra_sugerida():
    historial = _historial_constante(diario=2.0, insumos=[_insumo(stock=0.0, minimo=3.0)])

    resultado = calcular_prediccion(historial, horizonte=7)
    assert len(resultado["compras"]) == 1
    compra = resultado["compras"][0]
    # ceil(max(0, 14.0 + 3.0 − 0.0)) = 17
    assert compra["cantidadSugerida"] == 17.0
    assert compra["prioridad"] == "ALTA"  # quiebre dentro del horizonte (stock 0)
    assert compra["motivo"]


def test_historial_insuficiente():
    hoy = date.today()
    desde = hoy - timedelta(days=3)
    consumos = [
        {"fecha": _iso(desde + timedelta(days=i)), "insumoId": 1, "consumo": 2.0,
         "entradas": 0.0, "mermas": 0.0}
        for i in range(4)  # solo 4 días de consumo: menos del mínimo de 7
    ]
    historial = {
        "localId": 1, "dias": 90, "desde": _iso(desde), "hasta": _iso(hoy),
        "insumos": [_insumo()], "series": consumos, "producciones": [],
    }

    response = client.post(HISTORIAL_ENDPOINT, json={"historial": historial, "horizonteDias": 7})

    assert response.status_code == 200
    data = response.json()
    assert data["datosInsuficientes"] is True
    assert data["demanda"] == []
    assert data["mermas"] == []
    assert data["compras"] == []
    assert data["insights"]["fuente"] == "reglas"
    assert len(data["insights"]["recomendaciones"]) >= 1


def test_insights_fallback_sin_gemini(monkeypatch):
    # Sin clave válida no se toca la red: las recomendaciones salen de plantillas
    monkeypatch.setattr(recomendaciones, "hay_api_key_valida", lambda: False)
    hoy = date.today()
    lotes = [{"cantidad": 5.0, "fechaVencimiento": _iso(hoy + timedelta(days=2))}]
    historial = _historial_constante(diario=2.0, insumos=[_insumo(stock=1.0, lotes=lotes)])

    response = client.post(HISTORIAL_ENDPOINT, json={"historial": historial, "horizonteDias": 7})

    assert response.status_code == 200
    insights = response.json()["insights"]
    assert insights["fuente"] == "reglas"
    assert len(insights["recomendaciones"]) > 0
    assert all(r["titulo"] and r["detalle"] for r in insights["recomendaciones"])


@pytest.mark.parametrize("gemini_falla", [False, True])
def test_insights_gemini_mockeado(monkeypatch, gemini_falla):
    # Mismo patrón de mock que test_main.py: patch sobre main.client
    monkeypatch.setattr(recomendaciones, "hay_api_key_valida", lambda: True)
    respuesta_gemini = {
        "recomendaciones": [{
            "titulo": "Comprá leche antes del viernes",
            "detalle": "Tu cobertura es de 0.5 días y el stock se agota mañana.",
        }]
    }
    mock_response = MagicMock()
    mock_response.text = json.dumps(respuesta_gemini)

    historial = _historial_constante(diario=2.0, insumos=[_insumo(stock=1.0)])

    with patch("main.client.models.generate_content") as mock_generate:
        if gemini_falla:
            mock_generate.side_effect = Exception("boom de Gemini")
        else:
            mock_generate.return_value = mock_response

        response = client.post(HISTORIAL_ENDPOINT, json={"historial": historial, "horizonteDias": 7})

    assert response.status_code == 200  # el endpoint nunca falla por Gemini
    insights = response.json()["insights"]
    if gemini_falla:
        assert insights["fuente"] == "reglas"
        assert len(insights["recomendaciones"]) > 0
    else:
        assert insights["fuente"] == "gemini"
        assert insights["recomendaciones"] == respuesta_gemini["recomendaciones"]
        mock_generate.assert_called()
